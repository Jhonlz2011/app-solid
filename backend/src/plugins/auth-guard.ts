import { Elysia } from 'elysia';
import { UnauthorizedError } from '../core/errors';
import { auth, resolveCompanyIdFromOrg } from '../config/better-auth';
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

      // 2. Resolve company from Better Auth Organization (single source of truth)
      const activeOrgId = sessionData.session.activeOrganizationId;
      let resolvedCompanyId: number | null = null;

      if (activeOrgId) {
        resolvedCompanyId = await resolveCompanyIdFromOrg(activeOrgId);
      }

      // 3. Validate subdomain matches active organization
      const host = request.headers.get('host') || '';
      const slug = resolveSlugFromHost(host);

      if (slug) {
        const [hostCompany] = await adminDb
          .select({ id: companies.id })
          .from(companies)
          .where(eq(companies.slug, slug))
          .limit(1);

        if (hostCompany) {
          // If user's active org doesn't match the subdomain, deny access
          if (resolvedCompanyId && hostCompany.id !== resolvedCompanyId) {
            set.status = 403;
            throw new UnauthorizedError('Acceso denegado a este inquilino');
          }
          // If no active org set, use the host company
          if (!resolvedCompanyId) {
            resolvedCompanyId = hostCompany.id;
          }
        }
      }

      // Fallback: resolve from user.company_id denormalized cache
      if (!resolvedCompanyId) {
        const rawUser = sessionData.user as any;
        resolvedCompanyId = rawUser.companyId || rawUser.company_id || null;
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
