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
    .derive(({ currentCompanyId, membershipStatus, set }) => {
        if (!currentCompanyId || membershipStatus !== 'ACTIVE') {
            set.status = 403;
            throw new ForbiddenError('Se requiere una membresía activa en una empresa');
        }
        return {
            currentCompanyId: currentCompanyId as number,
        };
    });
