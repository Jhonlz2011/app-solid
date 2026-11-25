import { eq, and, inArray, sql } from '@app/schema';
import { adminDb, db, type Tx } from '../../core/db';
import {
    saasPlans,
    saasPlanFeatures,
    saasAddons,
    saasTenantSubscriptions,
    saasTenantAddons,
    saasTenantDocumentPacks,
    saasTenantUsage,
    companies,
    member,
    authUsers,
    authUserRoles,
    authRoles,
    authPermissions,
    authRolePermissions,
} from '@app/schema/tables';
import {
    SAAS_PLAN_IDS,
    SYSTEM_ROLES,
    type RbacModule,
    type SaasPaymentMethodType,
    type SaasPlanId,
    type SaasSubscriptionStatus,
} from '@app/schema/enums';
import {
    resolveAllowedModulesForPlan,
    resolveAllowedModulesFromFeatures,
    PLAN_DEFAULT_ENABLED_FEATURES,
    isUsableSubscriptionStatus,
    type TenantSubscriptionDetailResponseType,
} from '@app/schema/backend';
import { cacheService } from '../../core/cache';
import { invalidateMenuCaches } from '../settings/menu.service';
import { invalidateCompanyRbacCache } from '../rbac/rbac.permission.service';
// @ts-ignore
import { PERMISSIONS, ROLE_PERMISSIONS } from '../../seeds/seed-data';

export interface TenantEntitlements {
    companyId: number;
    planId: SaasPlanId;
    planName: string;
    planInterval: 'MONTHLY' | 'YEARLY' | 'ONE_TIME';
    status: SaasSubscriptionStatus;
    currentPeriodStart: string | null;
    currentPeriodEnd: string | null;
    gracePeriodEndsAt: string | null;
    features: Record<string, boolean | number>;
    sriDocumentsLimit: number; // -1 = ilimitado
    sriInterval: 'MONTHLY' | 'YEARLY'; // Intervalo de la cuota SRI (Free=YEARLY, Starter+=MONTHLY)
    maxUsers: number;
    hasFreeAccountantSeat: boolean;
    maxPosRegisters: number;
    maxStorageGb: number;
}

export interface CompanySeatUsage {
    regularActiveUsers: number;
    totalActiveUsers: number;
    accountantRoleId: number | null;
    freeAccountantUserId: string | null;
    accountantAssigned: boolean;
}

export interface EntitlementCheckResult {
    allowed: boolean;
    reason?: string;
    limit?: number;
    current?: number;
    remaining?: number;
}

export function hasUsableSubscription(entitlements: Pick<TenantEntitlements, 'status'>): boolean {
    return isUsableSubscriptionStatus(entitlements.status);
}

export function isExclusiveAccountantRole(roleIds: number[], accountantRoleId: number | null): boolean {
    return Boolean(accountantRoleId && roleIds.length === 1 && roleIds[0] === accountantRoleId);
}

const ENTITLEMENTS_CACHE_TTL = 3600; // 1 hora

/**
 * Evaluates effective subscription status against period/grace deadlines in real time
 * so expired trials or grace periods transition cleanly without requiring a cron job.
 */
export function resolveEffectiveSubscriptionStatus(
    rawStatus: SaasSubscriptionStatus,
    currentPeriodEnd: Date | null | undefined,
    gracePeriodEndsAt: Date | null | undefined,
    nowMs = Date.now(),
): SaasSubscriptionStatus {
    if (rawStatus === 'TRIAL' && currentPeriodEnd && currentPeriodEnd.getTime() <= nowMs) {
        return 'PENDING_PAYMENT';
    }
    if (rawStatus === 'GRACE_PERIOD' && gracePeriodEndsAt && gracePeriodEndsAt.getTime() <= nowMs) {
        return 'PAST_DUE';
    }
    return rawStatus;
}

/**
 * Single source of truth for tenant seat consumption.
 * - Counts active members (member.status = 'ACTIVE' AND authUsers.is_active = true).
 * - At most ONE active user whose ONLY role is 'contador' occupies the free accountant seat
 *   (when the plan includes free_accountant_seat) and does NOT count against regularActiveUsers.
 */
export async function getCompanySeatUsage(
    companyId: number,
    organizationId: string | null | undefined,
    dbClient: typeof adminDb | Tx = adminDb,
): Promise<CompanySeatUsage> {
    if (!organizationId) {
        return {
            regularActiveUsers: 0,
            totalActiveUsers: 0,
            accountantRoleId: null,
            freeAccountantUserId: null,
            accountantAssigned: false,
        };
    }

    const [ent, [accountantRole], activeRows] = await Promise.all([
        getTenantEntitlements(companyId),
        dbClient
            .select({ id: authRoles.id })
            .from(authRoles)
            .where(and(eq(authRoles.company_id, companyId), eq(authRoles.name, SYSTEM_ROLES.CONTADOR)))
            .limit(1),
        dbClient
            .select({
                userId: member.userId,
                roleId: authUserRoles.role_id,
            })
            .from(member)
            .innerJoin(authUsers, eq(authUsers.id, member.userId))
            .leftJoin(
                authUserRoles,
                and(
                    eq(authUserRoles.user_id, member.userId),
                    eq(authUserRoles.company_id, companyId),
                ),
            )
            .where(and(
                eq(member.organizationId, organizationId),
                eq(authUsers.is_active, true),
                eq(member.status, 'ACTIVE'),
            )),
    ]);

    const rolesByUser = new Map<string, number[]>();
    for (const row of activeRows) {
        let userRoles = rolesByUser.get(row.userId);
        if (!userRoles) {
            userRoles = [];
            rolesByUser.set(row.userId, userRoles);
        }
        if (row.roleId !== null && !userRoles.includes(row.roleId)) {
            userRoles.push(row.roleId);
        }
    }

    const accountantRoleId = accountantRole?.id ?? null;
    let freeAccountantUserId: string | null = null;

    if (ent.hasFreeAccountantSeat && accountantRoleId !== null) {
        for (const [userId, userRoles] of rolesByUser.entries()) {
            if (isExclusiveAccountantRole(userRoles, accountantRoleId)) {
                freeAccountantUserId = userId;
                break;
            }
        }
    }

    const totalActiveUsers = rolesByUser.size;
    const regularActiveUsers = totalActiveUsers - (freeAccountantUserId ? 1 : 0);

    return {
        regularActiveUsers,
        totalActiveUsers,
        accountantRoleId,
        freeAccountantUserId,
        accountantAssigned: freeAccountantUserId !== null,
    };
}

/**
 * Obtiene las entitlements consolidadas de una empresa (Plan + Add-ons + Packs prepago)
 * con caché en Redis acotado automáticamente si un trial o periodo de gracia vence pronto.
 */
export async function getTenantEntitlements(companyId: number): Promise<TenantEntitlements> {
    const cacheKey = `tenant:entitlements:${companyId}`;
    const cached = await cacheService.get<TenantEntitlements>(cacheKey);
    if (cached) {
        const effectiveStatus = resolveEffectiveSubscriptionStatus(
            cached.status,
            cached.currentPeriodEnd ? new Date(cached.currentPeriodEnd) : null,
            cached.gracePeriodEndsAt ? new Date(cached.gracePeriodEndsAt) : null,
        );
        if (effectiveStatus === cached.status) {
            return cached;
        }
        return { ...cached, status: effectiveStatus };
    }

    // 1. Obtener la suscripción del tenant (o fallback a 'free')
    const [subscription] = await adminDb
        .select()
        .from(saasTenantSubscriptions)
        .where(eq(saasTenantSubscriptions.company_id, companyId))
        .limit(1);

    const requestedPlanId = subscription?.plan_id;
    const planId: SaasPlanId = requestedPlanId && SAAS_PLAN_IDS.includes(requestedPlanId as SaasPlanId)
        ? requestedPlanId as SaasPlanId
        : 'free';
    const rawStatus = (subscription?.status as SaasSubscriptionStatus) || 'ACTIVE';
    const subStatus = resolveEffectiveSubscriptionStatus(
        rawStatus,
        subscription?.current_period_end,
        subscription?.grace_period_ends_at,
    );

    // 2. Obtener los datos del plan base
    const [plan] = await adminDb
        .select()
        .from(saasPlans)
        .where(eq(saasPlans.id, planId))
        .limit(1);

    const planName = plan?.name || (planId === 'free' ? 'Plan Freemium' : planId);
    const planInterval = (plan?.interval as TenantEntitlements['planInterval']) || 'MONTHLY';

    // 3. Obtener features asignadas al plan en la matriz saas_plan_features
    const planFeaturesRows = await adminDb
        .select()
        .from(saasPlanFeatures)
        .where(eq(saasPlanFeatures.plan_id, planId));

    const features: Record<string, boolean | number> = {};

    // Si existen en DB, cargarlas
    if (planFeaturesRows.length > 0) {
        for (const row of planFeaturesRows) {
            if (row.value_boolean !== null) {
                features[row.feature_code] = row.value_boolean;
            } else if (row.value_numeric !== null) {
                features[row.feature_code] = row.value_numeric;
            }
        }
    } else {
        // Fallback en memoria si la tabla maestra aún no se ha sembrado
        const defaultEnabled = PLAN_DEFAULT_ENABLED_FEATURES[planId] || PLAN_DEFAULT_ENABLED_FEATURES.free;
        for (const code of defaultEnabled) {
            features[code] = true;
        }
        if (planId === 'free') {
            features['max_users'] = 1;
            features['sri_documents_yearly'] = 15;
            features['sri_documents_monthly'] = 0;
            features['max_storage_mb'] = 150;
        } else if (planId.startsWith('starter')) {
            features['max_users'] = 2;
            features['free_accountant_seat'] = true;
            features['sri_documents_monthly'] = 250;
            features['max_storage_mb'] = 1024;
            features['max_pos_registers'] = 1;
        } else if (planId.startsWith('pro')) {
            features['max_users'] = 5;
            features['free_accountant_seat'] = true;
            features['sri_documents_monthly'] = -1;
            features['max_storage_mb'] = 5120;
            features['max_pos_registers'] = 3;
        } else if (planId.startsWith('enterprise')) {
            features['max_users'] = 15;
            features['free_accountant_seat'] = true;
            features['sri_documents_monthly'] = -1;
            features['max_storage_mb'] = 51200;
            features['max_pos_registers'] = 5;
        }
    }

    // 4. Sumar Add-ons activos contratados por el tenant
    const tenantAddonsRows = await adminDb
        .select({
            quantity: saasTenantAddons.quantity,
            addonType: saasAddons.addon_type,
            addonQuantity: saasAddons.quantity,
        })
        .from(saasTenantAddons)
        .innerJoin(saasAddons, eq(saasTenantAddons.addon_id, saasAddons.id))
        .where(
            and(
                eq(saasTenantAddons.company_id, companyId),
                eq(saasTenantAddons.status, 'ACTIVE')
            )
        );

    let extraUsers = 0;
    let extraStorageGb = 0;
    let extraPosRegisters = 0;

    for (const addon of tenantAddonsRows) {
        const totalUnits = (addon.quantity ?? 1) * (addon.addonQuantity ?? 1);
        if (addon.addonType === 'USER_SEATS') {
            extraUsers += totalUnits;
        } else if (addon.addonType === 'STORAGE_GB') {
            extraStorageGb += totalUnits;
        } else if (addon.addonType === 'POS_REGISTERS') {
            extraPosRegisters += totalUnits;
        }
    }

    // 5. Sumar paquetes prepago de comprobantes SRI activos con saldo
    const docPacks = await adminDb
        .select({
            remaining: saasTenantDocumentPacks.remaining_credits,
        })
        .from(saasTenantDocumentPacks)
        .where(
            and(
                eq(saasTenantDocumentPacks.company_id, companyId),
                eq(saasTenantDocumentPacks.status, 'ACTIVE')
            )
        );

    const prepagoCredits = docPacks.reduce((acc, p) => acc + (p.remaining || 0), 0);

    // 6. Consolidar límites
    const baseUsers = Number(features['max_users'] ?? 1);
    const totalMaxUsers = baseUsers + extraUsers;
    const hasAccountantSeat = Boolean(features['free_accountant_seat'] ?? false);

    const basePos = features['modules.pos'] ? Number(features['max_pos_registers'] ?? 1) : 0;
    const totalMaxPos = basePos + extraPosRegisters;

    const baseStorageMb = Number(features['max_storage_mb'] ?? 150);
    const totalStorageGb = (baseStorageMb / 1024) + extraStorageGb;

    // SRI: Determinar intervalo y límite correcto
    const sriMonthly = Number(features['sri_documents_monthly'] ?? 0);
    const sriYearly = Number(features['sri_documents_yearly'] ?? 0);
    const baseDocs = sriMonthly === -1 ? -1 : (sriMonthly > 0 ? sriMonthly : sriYearly);
    const sriInterval: 'MONTHLY' | 'YEARLY' = sriMonthly === -1 || sriMonthly > 0 ? 'MONTHLY' : 'YEARLY';
    const sriLimit = baseDocs === -1 ? -1 : baseDocs + prepagoCredits;

    const result: TenantEntitlements = {
        companyId,
        planId,
        planName,
        planInterval,
        status: subStatus,
        currentPeriodStart: subscription?.current_period_start ? subscription.current_period_start.toISOString() : null,
        currentPeriodEnd: subscription?.current_period_end ? subscription.current_period_end.toISOString() : null,
        gracePeriodEndsAt: subscription?.grace_period_ends_at ? subscription.grace_period_ends_at.toISOString() : null,
        features,
        sriDocumentsLimit: sriLimit,
        sriInterval,
        maxUsers: totalMaxUsers,
        hasFreeAccountantSeat: hasAccountantSeat,
        maxPosRegisters: totalMaxPos,
        maxStorageGb: totalStorageGb,
    };

    // Clamp TTL if a trial or grace deadline approaches within ENTITLEMENTS_CACHE_TTL
    let ttl = ENTITLEMENTS_CACHE_TTL;
    const deadline = subStatus === 'TRIAL'
        ? subscription?.current_period_end
        : subStatus === 'GRACE_PERIOD'
            ? subscription?.grace_period_ends_at
            : null;
    if (deadline) {
        const secondsRemaining = Math.ceil((deadline.getTime() - Date.now()) / 1000);
        if (secondsRemaining > 0 && secondsRemaining < ttl) {
            ttl = secondsRemaining;
        }
    }

    await cacheService.set(cacheKey, result, ttl);
    return result;
}

/**
 * Single consolidated builder for tenant subscription details + real-time usage.
 * Shared by GET /api/saas/subscription/me and POST /api/saas/subscription/upgrade.
 */
export async function getTenantSubscriptionDetail(
    companyId: number,
): Promise<TenantSubscriptionDetailResponseType> {
    const now = new Date();
    const periodKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    const [ent, [companyOrg], [usageRow], [packsRow]] = await Promise.all([
        getTenantEntitlements(companyId),
        adminDb
            .select({ organization_id: companies.organization_id })
            .from(companies)
            .where(eq(companies.id, companyId))
            .limit(1),
        adminDb
            .select()
            .from(saasTenantUsage)
            .where(and(
                eq(saasTenantUsage.company_id, companyId),
                eq(saasTenantUsage.period_key, periodKey),
            ))
            .limit(1),
        adminDb
            .select({ remaining: sql<number>`COALESCE(sum(${saasTenantDocumentPacks.remaining_credits}), 0)::int` })
            .from(saasTenantDocumentPacks)
            .where(and(
                eq(saasTenantDocumentPacks.company_id, companyId),
                eq(saasTenantDocumentPacks.status, 'ACTIVE'),
            )),
    ]);

    const seatUsage = await getCompanySeatUsage(companyId, companyOrg?.organization_id);

    return {
        companyId,
        plan: ent.planId,
        planName: ent.planName,
        planInterval: ent.planInterval,
        status: ent.status,
        currentPeriodStart: ent.currentPeriodStart,
        currentPeriodEnd: ent.currentPeriodEnd,
        gracePeriodEndsAt: ent.gracePeriodEndsAt,
        users: {
            active: seatUsage.regularActiveUsers,
            max: ent.maxUsers,
            hasFreeAccountantSeat: ent.hasFreeAccountantSeat,
            accountantAssigned: seatUsage.accountantAssigned,
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
}

/**
 * Invalida la caché de entitlements para un tenant.
 */
export async function invalidateTenantEntitlements(companyId: number): Promise<void> {
    await cacheService.del(`tenant:entitlements:${companyId}`);
}

/**
 * Verifica si un tenant puede registrar un nuevo usuario en su empresa.
 */
export async function canCreateUser(
    companyId: number,
    currentActiveUsersCount: number,
    isAccountant: boolean = false
): Promise<EntitlementCheckResult> {
    const ent = await getTenantEntitlements(companyId);

    if (!hasUsableSubscription(ent)) {
        return { allowed: false, reason: 'La suscripción de la empresa se encuentra suspendida.' };
    }

    // El asiento gratuito de contador no descuenta del límite general de usuarios
    if (isAccountant && ent.hasFreeAccountantSeat) {
        return { allowed: true, limit: ent.maxUsers, current: currentActiveUsersCount };
    }

    if (currentActiveUsersCount >= ent.maxUsers) {
        return {
            allowed: false,
            reason: `Has alcanzado el límite máximo de ${ent.maxUsers} usuario(s) permitidos en tu plan actual. Contrata asientos adicionales o actualiza tu plan.`,
            limit: ent.maxUsers,
            current: currentActiveUsersCount,
        };
    }

    return {
        allowed: true,
        limit: ent.maxUsers,
        current: currentActiveUsersCount,
        remaining: ent.maxUsers - currentActiveUsersCount,
    };
}

/**
 * Verifica si un tenant puede aperturar una nueva caja registradora POS.
 */
export async function canCreatePosRegister(
    companyId: number,
    currentRegistersCount: number
): Promise<EntitlementCheckResult> {
    const ent = await getTenantEntitlements(companyId);

    if (!hasUsableSubscription(ent)) {
        return { allowed: false, reason: 'La suscripción de la empresa no está activa.' };
    }

    if (!ent.features['modules.pos']) {
        return {
            allowed: false,
            reason: 'El módulo Punto de Venta (POS) no está habilitado en tu plan actual.',
        };
    }

    if (currentRegistersCount >= ent.maxPosRegisters) {
        return {
            allowed: false,
            reason: `Has alcanzado el límite de ${ent.maxPosRegisters} caja(s) POS permitidas. Adquiere el add-on de Caja POS adicional para ampliar tu capacidad.`,
            limit: ent.maxPosRegisters,
            current: currentRegistersCount,
        };
    }

    return {
        allowed: true,
        limit: ent.maxPosRegisters,
        current: currentRegistersCount,
        remaining: ent.maxPosRegisters - currentRegistersCount,
    };
}

/**
 * Verifica si el tenant puede emitir un comprobante electrónico SRI.
 */
export async function canEmitSriDocument(
    companyId: number,
    currentPeriodDocsUsed: number
): Promise<EntitlementCheckResult> {
    const ent = await getTenantEntitlements(companyId);

    if (!hasUsableSubscription(ent)) {
        return { allowed: false, reason: 'La cuenta se encuentra suspendida por falta de pago.' };
    }

    // Facturación ilimitada
    if (ent.sriDocumentsLimit === -1) {
        return { allowed: true, limit: -1, current: currentPeriodDocsUsed, remaining: -1 };
    }

    if (currentPeriodDocsUsed >= ent.sriDocumentsLimit) {
        return {
            allowed: false,
            reason: `Has consumido tu cuota de ${ent.sriDocumentsLimit} comprobantes electrónicos del periodo. Adquiere un paquete prepago de recarga o sube a un plan superior.`,
            limit: ent.sriDocumentsLimit,
            current: currentPeriodDocsUsed,
            remaining: 0,
        };
    }

    return {
        allowed: true,
        limit: ent.sriDocumentsLimit,
        current: currentPeriodDocsUsed,
        remaining: ent.sriDocumentsLimit - currentPeriodDocsUsed,
    };
}

/**
 * Verifica si el tenant tiene espacio de almacenamiento suficiente para subir un archivo.
 */
export async function canUploadFile(
    companyId: number,
    currentStorageBytes: number,
    newFileBytes: number
): Promise<EntitlementCheckResult> {
    const ent = await getTenantEntitlements(companyId);
    if (!hasUsableSubscription(ent)) {
        return { allowed: false, reason: 'La suscripción de la empresa no está activa.' };
    }
    const maxBytes = ent.maxStorageGb * 1024 * 1024 * 1024;

    if (currentStorageBytes + newFileBytes > maxBytes) {
        return {
            allowed: false,
            reason: `Espacio de almacenamiento insuficiente. Límite: ${ent.maxStorageGb} GB.`,
            limit: maxBytes,
            current: currentStorageBytes,
            remaining: Math.max(0, maxBytes - currentStorageBytes),
        };
    }

    return {
        allowed: true,
        limit: maxBytes,
        current: currentStorageBytes,
        remaining: maxBytes - (currentStorageBytes + newFileBytes),
    };
}

/**
 * Verifica si una feature específica está activa para el tenant.
 */
export async function hasFeature(companyId: number, featureCode: string): Promise<boolean> {
    const ent = await getTenantEntitlements(companyId);
    if (!hasUsableSubscription(ent)) return false;
    const val = ent.features[featureCode];
    if (typeof val === 'boolean') return val;
    if (typeof val === 'number') return val > 0 || val === -1;
    return false;
}

/**
 * Verifica si un módulo RBAC está habilitado para la empresa según su plan.
 */
export async function canAccessModule(companyId: number, moduleName: RbacModule): Promise<boolean> {
    const ent = await getTenantEntitlements(companyId);
    if (!hasUsableSubscription(ent)) return false;
    const allowedModules = resolveAllowedModulesFromFeatures(ent.features);
    return allowedModules.has(moduleName);
}

/**
 * Actualiza el plan de una empresa (Upgrade / Downgrade) y sincroniza permisos de RBAC
 * en lote sin redundancias ni anti-patrones.
 */
export async function upgradeCompanyPlan(
    companyId: number,
    newPlanId: SaasPlanId,
    paymentMethodType: SaasPaymentMethodType | null = null
): Promise<void> {
    const normalizedPlanId = newPlanId;
    const isFreePlan = normalizedPlanId === 'free';
    const subscriptionStatus: SaasSubscriptionStatus = isFreePlan ? 'ACTIVE' : 'PENDING_PAYMENT';
    const normalizedPaymentMethod: SaasPaymentMethodType | null = isFreePlan ? 'FREE' : paymentMethodType;

    await db.transaction(async (tx) => {
        // 1. Upsert en saas_tenant_subscriptions (fuente de verdad única; nunca reinicia trials al hacer upgrade)
        await tx
            .insert(saasTenantSubscriptions)
            .values({
                company_id: companyId,
                plan_id: normalizedPlanId,
                status: subscriptionStatus,
                payment_method_type: normalizedPaymentMethod,
                current_period_start: new Date(),
                current_period_end: null,
                grace_period_ends_at: null,
                updated_at: new Date(),
            })
            .onConflictDoUpdate({
                target: saasTenantSubscriptions.company_id,
                set: {
                    plan_id: normalizedPlanId,
                    status: subscriptionStatus,
                    payment_method_type: normalizedPaymentMethod,
                    current_period_end: null,
                    grace_period_ends_at: null,
                    updated_at: new Date(),
                },
            });

        // 2. Sincronizar permisos de RBAC (Upgrade + Downgrade real)
        const allowedModules = resolveAllowedModulesForPlan(normalizedPlanId);
        const disallowedSlugs = (PERMISSIONS as { slug: string; module: RbacModule }[])
            .filter(p => !allowedModules.has(p.module))
            .map(p => p.slug);

        if (disallowedSlugs.length > 0) {
            await tx
                .delete(authRolePermissions)
                .where(and(
                    eq(authRolePermissions.company_id, companyId),
                    inArray(authRolePermissions.permission_slug, disallowedSlugs),
                ));
        }

        // Obtener los roles existentes de esta empresa
        const companyRoles = await tx
            .select({ id: authRoles.id, name: authRoles.name })
            .from(authRoles)
            .where(eq(authRoles.company_id, companyId));

        // Para cada rol del sistema, asegurar los permisos permitidos en el nuevo plan
        const newPermRows: { role_id: number; permission_slug: string; company_id: number }[] = [];

        for (const role of companyRoles) {
            const checkFn = (ROLE_PERMISSIONS as Record<string, (slug: string) => boolean>)[role.name];
            if (!checkFn) continue;

            for (const p of PERMISSIONS as { slug: string; module: RbacModule }[]) {
                if (allowedModules.has(p.module) && checkFn(p.slug)) {
                    newPermRows.push({
                        role_id: role.id,
                        permission_slug: p.slug,
                        company_id: companyId,
                    });
                }
            }
        }

        if (newPermRows.length > 0) {
            await tx
                .insert(authRolePermissions)
                .values(newPermRows)
                .onConflictDoNothing();
        }
    });

    // 4. Invalidar cachés y notificar a los clientes vía SSE
    await invalidateTenantEntitlements(companyId);
    await invalidateMenuCaches(companyId);
    await invalidateCompanyRbacCache(companyId);
    await cacheService.invalidate(`tenant:${companyId}:*`);
}
