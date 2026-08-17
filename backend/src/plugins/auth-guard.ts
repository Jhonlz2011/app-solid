import { Elysia } from 'elysia';
import { UnauthorizedError } from '../core/errors';
import { auth } from '../config/better-auth';
import { adminDb, tenantStorage } from '../core/db';
import { companies } from '@app/schema/tables';
import { eq } from '@app/schema';
import { resolveSlugFromHost } from '@app/schema/utils';
import { getIpAndUserAgent } from './ip';
import { getUserRoles, getUserPermissions } from '../modules/users/rbac.permission.service';

export const authGuard = (app: Elysia) => app
  .derive(
    async ({ set, request }) => {
      // 1. Validate session with Better-Auth
      const sessionData = await auth.api.getSession({
        headers: request.headers,
      });

      if (!sessionData || !sessionData.user) {
        set.status = 401;
        throw new UnauthorizedError('Sesión requerida');
      }

      // 2. Resolve host and check subdomain
      const host = request.headers.get('host') || '';
      const slug = resolveSlugFromHost(host);
      let hostCompanyId: number | null = null;

      if (slug) {
        const [comp] = await adminDb
          .select({ id: companies.id })
          .from(companies)
          .where(eq(companies.slug, slug))
          .limit(1);
        if (comp) {
          hostCompanyId = comp.id;
        }
      }

      const rawUser = sessionData.user as any;
      const userCompanyId = rawUser.companyId || rawUser.company_id || (rawUser.activeOrganizationId ? Number(rawUser.activeOrganizationId) : null);
      const activeOrgId = sessionData.session.activeOrganizationId ? Number(sessionData.session.activeOrganizationId) : null;
      const resolvedCompanyId = hostCompanyId || activeOrgId || userCompanyId;

      // Strict validation: check that user session matches requested subdomain
      if (hostCompanyId && userCompanyId && hostCompanyId !== userCompanyId && activeOrgId && activeOrgId !== hostCompanyId) {
        set.status = 403;
        throw new UnauthorizedError('Acceso denegado a este inquilino');
      }

      const { ipAddress } = getIpAndUserAgent(request);

      // Set tenant context in AsyncLocalStorage for the entire request lifecycle.
      // This enables auto-injection of set_config('app.current_company_id', ...)
      // inside every db.transaction() call, enforcing RLS policies automatically.
      tenantStorage.enterWith({
        companyId: resolvedCompanyId || undefined,
        userId: sessionData.user.id,
        ipAddress: ipAddress || undefined,
      });

      const [roles, permissions] = await Promise.all([
        getUserRoles(sessionData.user.id, resolvedCompanyId),
        getUserPermissions(sessionData.user.id, resolvedCompanyId),
      ]);

      return {
        currentUserId: sessionData.user.id,
        currentCompanyId: resolvedCompanyId,
        currentSessionId: sessionData.session.id,
        currentRoles: roles,
        currentPermissions: permissions,
        currentUser: sessionData.user,
      };
    }
  );
