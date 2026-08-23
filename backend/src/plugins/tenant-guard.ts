import { Elysia } from 'elysia';
import { authGuard } from './auth-guard';
import { ForbiddenError } from '../core/errors';

/**
 * Tenant Guard Plugin
 * Ensures the request has a valid authenticated session AND an active resolved company.
 * Narrows `currentCompanyId` from `number | null` to `number`.
 */
export const tenantGuard = (app: Elysia) => app
    .use(authGuard)
    .derive(({ currentCompanyId, set }) => {
        if (!currentCompanyId) {
            set.status = 403;
            throw new ForbiddenError('Se requiere seleccionar una empresa activa');
        }
        return {
            currentCompanyId: currentCompanyId as number,
        };
    });
