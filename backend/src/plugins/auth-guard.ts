import { Elysia } from 'elysia';
import { UnauthorizedError } from '../core/errors';
import { auth, resolveCompanyIdFromOrg } from '../config/better-auth';
import { adminDb, tenantStorage } from '../core/db';
import { companies, member } from '@app/schema/tables';
import { eq, and } from '@app/schema';
import { resolveSlugFromHost } from '@app/schema/utils';
import { getIpAndUserAgent } from './ip';
import { getUserRoles, getUserPermissions } from '../modules/rbac/rbac.permission.service';

// ============================================================================
// Type for Better Auth user with application-level denormalized fields
// ============================================================================
type AuthUserWithCompany = { companyId?: number; company_id?: number };

export const authGuard = (app: Elysia) => app
  .derive(
    async ({ set, request }) => {
      // 1. Validate session with Better-Auth
      const sessionData = await auth.api.getSession({
        headers: request.headers,
      });

      if (!sessionData?.user) {
        set.status = 401;
        throw new UnauthorizedError('Sesión requerida');
      }

      const { user, session } = sessionData;
      const rawUser = user as typeof user & AuthUserWithCompany;

      // 2. Resolve company from Better Auth Organization (single source of truth)
      let resolvedCompanyId: number | null = null;

      if (session.activeOrganizationId) {
        resolvedCompanyId = await resolveCompanyIdFromOrg(session.activeOrganizationId);
      }

      // 3. Validate subdomain matches active organization & verify user membership
      const host = request.headers.get('x-original-host') || request.headers.get('origin') || request.headers.get('host') || '';
      const slug = request.headers.get('x-tenant-slug') || resolveSlugFromHost(host);

      if (slug) {
        const [hostCompany] = await adminDb
          .select({ id: companies.id, organization_id: companies.organization_id })
          .from(companies)
          .where(eq(companies.slug, slug))
          .limit(1);

        if (hostCompany) {
          // If active org already matches host company, keep it
          if (resolvedCompanyId && hostCompany.id === resolvedCompanyId) {
            // active organization matches host
          } else {
            // Verify if user is an authorized member of this host company
            let isAuthorizedMember = false;

            if (hostCompany.organization_id) {
              const [memberRow] = await adminDb
                .select({ id: member.id })
                .from(member)
                .where(and(
                  eq(member.userId, user.id),
                  eq(member.organizationId, hostCompany.organization_id)
                ))
                .limit(1);

              if (memberRow) isAuthorizedMember = true;
            }

            // Fallback: check denormalized company_id on user record
            const userCompanyId = rawUser.companyId ?? rawUser.company_id;
            if (userCompanyId === hostCompany.id) {
              isAuthorizedMember = true;
            }

            if (!isAuthorizedMember) {
              set.status = 403;
              throw new UnauthorizedError('Acceso denegado a este inquilino');
            }

            // User is a valid member: activate this company context for the request
            resolvedCompanyId = hostCompany.id;
          }
        }
      }

      // 4. Final fallback: resolve from user.company_id ONLY if user belongs to a single org.
      // If the user is a member of multiple organizations and no activeOrganizationId is set
      // (e.g. fresh OAuth login), leave resolvedCompanyId null so the frontend shows the
      // tenant selector instead of auto-routing to the first company.
      if (!resolvedCompanyId) {
        const userCompanyId = rawUser.companyId ?? rawUser.company_id ?? null;

        if (userCompanyId) {
          // Quick check: does the user belong to more than 1 org?
          const memberRows = await adminDb
            .select({ orgId: member.organizationId })
            .from(member)
            .where(eq(member.userId, user.id))
            .limit(2);

          // Only fallback to denormalized company_id if user has ≤ 1 membership
          if (memberRows.length <= 1) {
            resolvedCompanyId = userCompanyId;
          }
          // If > 1 memberships and no activeOrganizationId → null
          // → getMe() returns companyId: 0, companySlug: null
          // → Frontend shows org selector
        }
      }

      const { ipAddress } = getIpAndUserAgent(request);

      // 5. Set tenant context in AsyncLocalStorage for the entire request lifecycle.
      // This enables auto-injection of set_config('app.current_company_id', ...)
      // inside every db.transaction() call, enforcing RLS policies automatically.
      tenantStorage.enterWith({
        companyId: resolvedCompanyId || undefined,
        userId: user.id,
        ipAddress: ipAddress || undefined,
      });

      const [roles, permissions] = await Promise.all([
        getUserRoles(user.id, resolvedCompanyId),
        getUserPermissions(user.id, resolvedCompanyId),
      ]);

      return {
        currentUserId: user.id,
        currentCompanyId: resolvedCompanyId,
        currentSessionId: session.id,
        currentRoles: roles,
        currentPermissions: permissions,
        currentUser: user,
      };
    }
  );
