import { Elysia } from 'elysia';
import { hasPermission } from '../services/rbac.service';
import { ForbiddenError, UnauthorizedError } from '../services/errors';

export const rbac = (app: Elysia) => app
    .macro(({ onBeforeHandle }) => ({
        permission(permission: string) {
            onBeforeHandle(async ({ currentUserId }: { currentUserId?: number }) => {
                if (!currentUserId) {
                    throw new UnauthorizedError('Usuario no autenticado');
                }
                const allowed = await hasPermission(currentUserId, permission);
                if (!allowed) {
                    throw new ForbiddenError(`Permiso denegado: ${permission}`);
                }
            });
        },
    }));