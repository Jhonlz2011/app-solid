import { Elysia } from 'elysia';
import { tenantGuard } from '../../plugins/tenant-guard';
import { adminDb } from '../../core/db';
import {
    saasPlans,
    saasFeatures,
    saasPlanFeatures,
    saasAddons,
    saasDocumentPackages,
    saasTenantSubscriptions,
    saasTenantDocumentPacks,
    saasTenantUsage,
    companies,
    authUsers,
    authUserRoles,
    authRoles,
    member,
} from '@app/schema/tables';
import { eq, and, sql, asc } from '@app/schema';
import {
    getTenantEntitlements,
    upgradeCompanyPlan,
} from './entitlements.service';
import {
    SaasPlansResponseSchema,
    SaasAddonsResponseSchema,
    SaasDocumentPacksResponseSchema,
    TenantSubscriptionDetailResponseSchema,
    UpgradePlanBodySchema,
    type SaasPlanItemType,
    type SaasAddonItemType,
    type SaasDocumentPackItemType,
    type TenantSubscriptionDetailResponseType,
} from '@app/schema/backend';
import { broadcastToTenant } from '../../core/sse/events';
import { RealtimeEvents } from '@app/schema/realtime-events';
import { DomainError } from '../../core/errors';

// 1. PUBLIC ROUTES (Plans, Add-ons, Prepaid Packs)
const publicSaasRoutes = new Elysia()
    /**
     * Get all active public plans with their features
     */
    .get('/plans', async (): Promise<SaasPlanItemType[]> => {
        const plans = await adminDb
            .select()
            .from(saasPlans)
            .where(eq(saasPlans.is_active, true))
            .orderBy(asc(saasPlans.sort_order));

        if (plans.length === 0) return [];

        // Load plan features
        const featureMatrix = await adminDb
            .select({
                plan_id: saasPlanFeatures.plan_id,
                feature_code: saasPlanFeatures.feature_code,
                value_boolean: saasPlanFeatures.value_boolean,
                value_numeric: saasPlanFeatures.value_numeric,
                name: saasFeatures.name,
                category: saasFeatures.category,
                unit_label: saasFeatures.unit_label,
            })
            .from(saasPlanFeatures)
            .innerJoin(saasFeatures, eq(saasPlanFeatures.feature_code, saasFeatures.code));

        const featuresByPlan = new Map<string, {
            map: Record<string, boolean | number | string>;
            details: { code: string; name: string; category: string; value: boolean | number | string; unit_label: string | null }[];
        }>();

        for (const f of featureMatrix) {
            if (!featuresByPlan.has(f.plan_id)) {
                featuresByPlan.set(f.plan_id, { map: {}, details: [] });
            }
            const bucket = featuresByPlan.get(f.plan_id)!;
            const val = f.value_boolean !== null ? f.value_boolean : (f.value_numeric !== null ? f.value_numeric : true);
            bucket.map[f.feature_code] = val;
            bucket.details.push({
                code: f.feature_code,
                name: f.name,
                category: f.category,
                value: val,
                unit_label: f.unit_label,
            });
        }

        return plans.map(p => {
            const feat = featuresByPlan.get(p.id) || { map: {}, details: [] };
            return {
                id: p.id,
                name: p.name,
                description: p.description,
                interval: p.interval,
                price_usd: p.price_usd,
                annual_discount_percent: p.annual_discount_percent ?? 0,
                is_popular: p.is_popular ?? false,
                sort_order: p.sort_order ?? 0,
                features: feat.map,
                feature_details: feat.details,
            };
        });
    }, {
        response: SaasPlansResponseSchema,
    })

    /**
     * Get all active SaaS add-ons
     */
    .get('/addons', async (): Promise<SaasAddonItemType[]> => {
        const addons = await adminDb
            .select()
            .from(saasAddons)
            .where(eq(saasAddons.is_active, true))
            .orderBy(asc(saasAddons.sort_order));

        return addons.map(a => ({
            id: a.id,
            name: a.name,
            description: a.description,
            addon_type: a.addon_type,
            billing_type: a.billing_type,
            price_usd: a.price_usd,
            quantity: a.quantity ?? 1,
            unit_label: a.unit_label,
        }));
    }, {
        response: SaasAddonsResponseSchema,
    })

    /**
     * Get all active prepaid SRI document packages
     */
    .get('/document-packs', async (): Promise<SaasDocumentPackItemType[]> => {
        const packs = await adminDb
            .select()
            .from(saasDocumentPackages)
            .where(eq(saasDocumentPackages.is_active, true))
            .orderBy(asc(saasDocumentPackages.document_count));

        return packs.map(p => ({
            id: p.id,
            name: p.name,
            document_count: p.document_count,
            price_usd: p.price_usd,
            unit_cost_usd: p.unit_cost_usd,
            is_popular: p.is_popular ?? false,
        }));
    }, {
        response: SaasDocumentPacksResponseSchema,
    });

// 2. PROTECTED TENANT ROUTES (Subscription status & upgrade)
const protectedSaasRoutes = new Elysia()
    .use(tenantGuard)
    /**
     * Get subscription details, limits, and live usage for current tenant
     */
    .get('/subscription/me', async ({ currentCompanyId }): Promise<TenantSubscriptionDetailResponseType> => {
        const ent = await getTenantEntitlements(currentCompanyId);

        // 1. Subscription DB row
        const [subRow] = await adminDb
            .select()
            .from(saasTenantSubscriptions)
            .where(eq(saasTenantSubscriptions.company_id, currentCompanyId))
            .limit(1);

        // 2. Active users count in tenant
        const [companyOrg] = await adminDb
            .select({ organization_id: companies.organization_id })
            .from(companies)
            .where(eq(companies.id, currentCompanyId))
            .limit(1);

        let activeUsersCount = 1;
        if (companyOrg?.organization_id) {
            const [countRow] = await adminDb
                .select({ count: sql<number>`count(distinct ${member.userId})::int` })
                .from(member)
                .innerJoin(authUsers, eq(authUsers.id, member.userId))
                .where(and(
                    eq(member.organizationId, companyOrg.organization_id),
                    eq(authUsers.is_active, true)
                ));
            activeUsersCount = countRow?.count ?? 1;
        }

        // 3. Check if company has an assigned accountant
        const accountantRoles = await adminDb
            .select({ id: authRoles.id })
            .from(authRoles)
            .where(and(
                eq(authRoles.company_id, currentCompanyId),
                eq(authRoles.name, 'contador')
            ));

        let accountantAssigned = false;
        if (accountantRoles.length > 0) {
            const [accRow] = await adminDb
                .select({ count: sql<number>`count(*)::int` })
                .from(authUserRoles)
                .innerJoin(authUsers, eq(authUsers.id, authUserRoles.user_id))
                .where(and(
                    eq(authUserRoles.company_id, currentCompanyId),
                    eq(authUserRoles.role_id, accountantRoles[0].id),
                    eq(authUsers.is_active, true)
                ));
            accountantAssigned = (accRow?.count ?? 0) > 0;
        }

        // 4. Usage counters
        const now = new Date();
        const periodKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

        const [usageRow] = await adminDb
            .select()
            .from(saasTenantUsage)
            .where(and(
                eq(saasTenantUsage.company_id, currentCompanyId),
                eq(saasTenantUsage.period_key, periodKey)
            ))
            .limit(1);

        // 5. Prepaid SRI packs balance
        const [packsRow] = await adminDb
            .select({ remaining: sql<number>`COALESCE(sum(${saasTenantDocumentPacks.remaining_credits}), 0)::int` })
            .from(saasTenantDocumentPacks)
            .where(and(
                eq(saasTenantDocumentPacks.company_id, currentCompanyId),
                eq(saasTenantDocumentPacks.status, 'ACTIVE')
            ));

        return {
            companyId: currentCompanyId,
            plan: ent.planId,
            planName: ent.planName,
            planInterval: ent.planInterval,
            status: ent.status,
            currentPeriodStart: subRow?.current_period_start ? subRow.current_period_start.toISOString() : null,
            currentPeriodEnd: subRow?.current_period_end ? subRow.current_period_end.toISOString() : null,
            gracePeriodEndsAt: subRow?.grace_period_ends_at ? subRow.grace_period_ends_at.toISOString() : null,
            users: {
                active: activeUsersCount,
                max: ent.maxUsers,
                hasFreeAccountantSeat: ent.hasFreeAccountantSeat,
                accountantAssigned,
            },
            sriDocuments: {
                monthlyLimit: ent.sriDocumentsLimit,
                monthlyUsed: usageRow?.sri_documents_used ?? 0,
                prepaidBalance: packsRow?.remaining ?? 0,
                unlimited: ent.sriDocumentsLimit === -1,
            },
            storage: {
                usedBytes: Number(usageRow?.storage_bytes_used ?? 0),
                limitGb: ent.maxStorageGb,
            },
            pos: {
                maxRegisters: ent.maxPosRegisters,
            },
            features: ent.features,
        };
    }, {
        response: TenantSubscriptionDetailResponseSchema,
    })

    /**
     * Upgrade or modify company plan
     */
    .post('/subscription/upgrade', async ({ body, currentCompanyId }): Promise<TenantSubscriptionDetailResponseType> => {
        // Validate plan exists
        const [targetPlan] = await adminDb
            .select()
            .from(saasPlans)
            .where(and(eq(saasPlans.id, body.planId), eq(saasPlans.is_active, true)))
            .limit(1);

        if (!targetPlan) {
            throw new DomainError('El plan seleccionado no existe o no está activo', 404);
        }

        await upgradeCompanyPlan(currentCompanyId, body.planId);

        // Broadcast real-time update to all active users of this tenant
        broadcastToTenant(currentCompanyId, RealtimeEvents.MENU.UPDATED, {
            action: 'PLAN_UPGRADED',
            newPlan: body.planId,
            timestamp: new Date().toISOString(),
        });

        // Return fresh details
        const ent = await getTenantEntitlements(currentCompanyId);
        return {
            companyId: currentCompanyId,
            plan: ent.planId,
            planName: ent.planName,
            planInterval: ent.planInterval,
            status: ent.status,
            currentPeriodStart: new Date().toISOString(),
            currentPeriodEnd: null,
            gracePeriodEndsAt: null,
            users: {
                active: 1,
                max: ent.maxUsers,
                hasFreeAccountantSeat: ent.hasFreeAccountantSeat,
                accountantAssigned: false,
            },
            sriDocuments: {
                monthlyLimit: ent.sriDocumentsLimit,
                monthlyUsed: 0,
                prepaidBalance: 0,
                unlimited: ent.sriDocumentsLimit === -1,
            },
            storage: {
                usedBytes: 0,
                limitGb: ent.maxStorageGb,
            },
            pos: {
                maxRegisters: ent.maxPosRegisters,
            },
            features: ent.features,
        };
    }, {
        body: UpgradePlanBodySchema,
        response: TenantSubscriptionDetailResponseSchema,
    });

export const saasRoutes = new Elysia({ prefix: '/saas' })
    .use(publicSaasRoutes)
    .use(protectedSaasRoutes);
