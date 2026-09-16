import { eq, and, sql } from '@app/schema';
import { adminDb, db } from '../../core/db';
import {
    companies,
    saasPlans,
    saasFeatures,
    saasPlanFeatures,
    saasAddons,
    saasTenantSubscriptions,
    saasTenantAddons,
    saasTenantDocumentPacks,
    authRoles,
    authPermissions,
    authRolePermissions,
} from '@app/schema/tables';
import type { RbacModule } from '@app/schema/enums';
import {
    resolveAllowedModulesForPlan,
    resolveAllowedModulesFromFeatures,
    PLAN_DEFAULT_ENABLED_FEATURES,
} from '@app/schema/backend';
import { cacheService } from '../../core/cache';
import { invalidateMenuCaches } from '../settings/menu.service';
// @ts-ignore
import { PERMISSIONS, ROLE_PERMISSIONS } from '../../seeds/seed-data';

export interface TenantEntitlements {
    companyId: number;
    planId: string;
    planName: string;
    planInterval: 'MONTHLY' | 'YEARLY' | 'ONE_TIME';
    status: 'ACTIVE' | 'GRACE_PERIOD' | 'PAST_DUE' | 'SUSPENDED';
    features: Record<string, boolean | number>;
    sriDocumentsLimit: number; // -1 = ilimitado
    maxUsers: number;
    hasFreeAccountantSeat: boolean;
    maxPosRegisters: number;
    maxStorageGb: number;
}

export interface EntitlementCheckResult {
    allowed: boolean;
    reason?: string;
    limit?: number;
    current?: number;
    remaining?: number;
}

const ENTITLEMENTS_CACHE_TTL = 86400; // 24 horas

/**
 * Obtiene las entitlements consolidadas de una empresa (Plan + Add-ons + Packs prepago)
 * con caché de 24 horas en Redis para garantizar latencia ultra baja.
 */
export async function getTenantEntitlements(companyId: number): Promise<TenantEntitlements> {
    const cacheKey = `tenant:entitlements:${companyId}`;

    return await cacheService.getOrSet(
        cacheKey,
        async () => {
            // 1. Obtener la suscripción del tenant (o fallback a 'free')
            const [subscription] = await adminDb
                .select()
                .from(saasTenantSubscriptions)
                .where(eq(saasTenantSubscriptions.company_id, companyId))
                .limit(1);

            let planId = subscription?.plan_id || 'free';
            const subStatus = (subscription?.status as TenantEntitlements['status']) || 'ACTIVE';

            // 2. Obtener los datos del plan base
            const [plan] = await adminDb
                .select()
                .from(saasPlans)
                .where(eq(saasPlans.id, planId))
                .limit(1);

            const planName = plan?.name || (planId === 'free' ? 'Plan Freemium Emprendedor' : planId);
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
                    features['sri_documents_monthly'] = 15;
                    features['storage_limit_gb'] = 1;
                } else if (planId.startsWith('starter')) {
                    features['max_users'] = 2;
                    features['has_accountant_seat'] = true;
                    features['sri_documents_monthly'] = 250;
                    features['storage_limit_gb'] = 5;
                    features['max_pos_registers'] = 1;
                } else if (planId.startsWith('pro')) {
                    features['max_users'] = 5;
                    features['has_accountant_seat'] = true;
                    features['sri_documents_monthly'] = -1;
                    features['storage_limit_gb'] = 20;
                    features['max_pos_registers'] = 2;
                } else if (planId.startsWith('enterprise')) {
                    features['max_users'] = 15;
                    features['has_accountant_seat'] = true;
                    features['sri_documents_monthly'] = -1;
                    features['storage_limit_gb'] = 50;
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
            const hasAccountantSeat = Boolean(features['has_accountant_seat'] ?? false);

            const basePos = features['modules.pos'] ? Number(features['max_pos_registers'] ?? 1) : 0;
            const totalMaxPos = basePos + extraPosRegisters;

            const baseStorage = Number(features['storage_limit_gb'] ?? 1);
            const totalStorageGb = baseStorage + extraStorageGb;

            const baseDocs = Number(features['sri_documents_monthly'] ?? 15);
            const sriLimit = baseDocs === -1 ? -1 : baseDocs + prepagoCredits;

            return {
                companyId,
                planId,
                planName,
                planInterval,
                status: subStatus,
                features,
                sriDocumentsLimit: sriLimit,
                maxUsers: totalMaxUsers,
                hasFreeAccountantSeat: hasAccountantSeat,
                maxPosRegisters: totalMaxPos,
                maxStorageGb: totalStorageGb,
            };
        },
        ENTITLEMENTS_CACHE_TTL
    );
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

    if (ent.status === 'SUSPENDED') {
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

    if (ent.status === 'SUSPENDED') {
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
    const allowedModules = resolveAllowedModulesFromFeatures(ent.features);
    return allowedModules.has(moduleName);
}

/**
 * Actualiza el plan de una empresa (Upgrade / Downgrade) y sincroniza permisos de RBAC
 * en lote sin redundancias ni anti-patrones.
 */
export async function upgradeCompanyPlan(
    companyId: number,
    newPlanId: string,
    paymentMethodType: string = 'CARD'
): Promise<void> {
    const normalizedPlanId = newPlanId.toLowerCase().trim();

    await db.transaction(async (tx) => {
        // 1. Actualizar plan en la tabla companies
        await tx
            .update(companies)
            .set({ plan: normalizedPlanId, updated_at: new Date() })
            .where(eq(companies.id, companyId));

        // 2. Upsert en saas_tenant_subscriptions
        await tx
            .insert(saasTenantSubscriptions)
            .values({
                company_id: companyId,
                plan_id: normalizedPlanId,
                status: 'ACTIVE',
                payment_method_type: paymentMethodType,
                current_period_start: new Date(),
                updated_at: new Date(),
            })
            .onConflictDoUpdate({
                target: saasTenantSubscriptions.company_id,
                set: {
                    plan_id: normalizedPlanId,
                    status: 'ACTIVE',
                    payment_method_type: paymentMethodType,
                    updated_at: new Date(),
                },
            });

        // 3. Sincronizar permisos de RBAC para los roles existentes de la empresa
        const allowedModules = resolveAllowedModulesForPlan(normalizedPlanId);

        // Obtener los roles existentes de esta empresa
        const companyRoles = await tx
            .select({ id: authRoles.id, name: authRoles.name })
            .from(authRoles)
            .where(eq(authRoles.company_id, companyId));

        // Para cada rol del sistema, determinar los permisos que deben estar presentes
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
    await cacheService.invalidate(`tenant:${companyId}:*`);
}
