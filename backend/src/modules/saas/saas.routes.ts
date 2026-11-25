import { Elysia } from 'elysia';
import { tenantGuard } from '../../plugins/tenant-guard';
import { rbac } from '../../plugins/rbac';
import { adminDb } from '../../core/db';
import {
    saasPlans,
    saasFeatures,
    saasPlanFeatures,
    saasAddons,
    saasDocumentPackages,
} from '@app/schema/tables';
import { eq, and, asc } from '@app/schema';
import {
    getTenantSubscriptionDetail,
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
import { mfaStepUp } from '../../plugins/mfa-step-up';

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
    .use(rbac)
    .use(mfaStepUp)
    /**
     * Get subscription details, limits, and live usage for current tenant
     */
    .get('/subscription/me', async ({ currentCompanyId }): Promise<TenantSubscriptionDetailResponseType> => {
        return getTenantSubscriptionDetail(currentCompanyId);
    }, {
        response: TenantSubscriptionDetailResponseSchema,
    })

    /**
     * Upgrade or modify company plan (allowed even when billing is blocked so owner can recover/switch to Free)
     */
    .post('/subscription/upgrade', async ({ body, currentCompanyId }): Promise<TenantSubscriptionDetailResponseType> => {
        const [targetPlan] = await adminDb
            .select()
            .from(saasPlans)
            .where(and(eq(saasPlans.id, body.planId), eq(saasPlans.is_active, true)))
            .limit(1);

        if (!targetPlan) {
            throw new DomainError('El plan seleccionado no existe o no está activo', 404);
        }

        await upgradeCompanyPlan(currentCompanyId, body.planId);

        broadcastToTenant(currentCompanyId, RealtimeEvents.MENU.UPDATED, {
            action: 'PLAN_UPGRADED',
            newPlan: body.planId,
            timestamp: new Date().toISOString(),
        });

        return getTenantSubscriptionDetail(currentCompanyId);
    }, {
        body: UpgradePlanBodySchema,
        response: TenantSubscriptionDetailResponseSchema,
        permission: { slug: 'companies.update', allowWhenBillingBlocked: true },
    });

export const saasRoutes = new Elysia({ prefix: '/saas' })
    .use(publicSaasRoutes)
    .use(protectedSaasRoutes);
