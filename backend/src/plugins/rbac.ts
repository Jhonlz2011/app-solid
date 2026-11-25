import { Elysia } from 'elysia';
import { DomainError, ForbiddenError, UnauthorizedError } from '../core/errors';
import { type PermissionSlug, type RbacModule, SYSTEM_ROLES } from '@app/schema/enums';
import { resolveAllowedModulesFromFeatures } from '@app/schema/backend';
import { getTenantEntitlements, hasUsableSubscription } from '../modules/saas/entitlements.service';

export type RbacPermissionConfig =
    | PermissionSlug
    | {
        slug: PermissionSlug;
        allowWhenBillingBlocked?: boolean;
    };

/**
 * RBAC macro plugin — enforces tenant subscription usability, plan module entitlements,
 * and per-user permissions using context already resolved by authGuard.derive().
 *
 * Only `superadmin` bypasses user-level permission checks, but NEVER bypasses
 * tenant subscription status or plan module boundaries.
 */
export const rbac = (app: Elysia) => app
    .macro(({ onBeforeHandle }) => ({
        permission(config: RbacPermissionConfig) {
            const slug = typeof config === 'string' ? config : config.slug;
            const allowWhenBillingBlocked = typeof config === 'string' ? false : Boolean(config.allowWhenBillingBlocked);
            const moduleName = slug.split('.')[0] as RbacModule;

            onBeforeHandle(async ({ currentUserId, currentCompanyId, currentRoles, currentPermissions }: {
                currentUserId?: string | number;
                currentCompanyId?: number | null;
                currentRoles?: string[];
                currentPermissions?: string[];
            }) => {
                if (!currentUserId) {
                    throw new UnauthorizedError('Usuario no autenticado');
                }

                if (currentCompanyId) {
                    const entitlements = await getTenantEntitlements(currentCompanyId);
                    if (!allowWhenBillingBlocked && !hasUsableSubscription(entitlements)) {
                        throw new DomainError(
                            'La suscripción de la empresa requiere regularización para continuar.',
                            403,
                            { code: 'SUBSCRIPTION_BLOCKED' }
                        );
                    }

                    const allowedModules = resolveAllowedModulesFromFeatures(entitlements.features);
                    if (!allowedModules.has(moduleName)) {
                        throw new DomainError(
                            `El módulo '${moduleName}' no está incluido en tu plan actual.`,
                            403,
                            { code: 'FEATURE_NOT_IN_PLAN' }
                        );
                    }
                }

                // Only superadmin bypasses user-level RBAC — admin requires explicit permissions
                if (currentRoles?.includes(SYSTEM_ROLES.SUPERADMIN)) {
                    return;
                }
                if (!currentPermissions?.includes(slug)) {
                    throw new ForbiddenError(`Permiso denegado: ${slug}`);
                }
            });
        },
    }));