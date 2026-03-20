import { Elysia } from 'elysia';
import { ForbiddenError, UnauthorizedError } from '../services/errors';
import type { PermissionSlug } from '@app/schema/enums';

/**
 * RBAC macro plugin — uses currentRoles & currentPermissions
 * already resolved by authGuard.derive(), avoiding redundant Redis GETs.
 *
 * Only `superadmin` bypasses all permission checks.
 * `admin` must have explicit permissions assigned.
 */
export const rbac = (app: Elysia) => app
    .macro(({ onBeforeHandle }) => ({
        permission(permission: PermissionSlug) {
            onBeforeHandle(async ({ currentUserId, currentRoles, currentPermissions }: {
                currentUserId?: number;
                currentRoles?: string[];
                currentPermissions?: string[];
            }) => {
                if (!currentUserId) {
                    throw new UnauthorizedError('Usuario no autenticado');
                }
                // Only superadmin bypasses — admin requires explicit permissions
                if (currentRoles?.includes('superadmin')) {
                    return;
                }
                if (!currentPermissions?.includes(permission)) {
                    throw new ForbiddenError(`Permiso denegado: ${permission}`);
                }
            });
        },
    }));