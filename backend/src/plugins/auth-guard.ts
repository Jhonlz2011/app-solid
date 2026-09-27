import { Elysia } from 'elysia';
import { ForbiddenError, UnauthorizedError } from '../core/errors';
import { auth, resolveCompanyIdFromOrg } from '../config/better-auth';
import { adminDb, tenantStorage } from '../core/db';
import { member } from '@app/schema/tables';
import { companies } from '@app/schema/tables';
import { eq, and, asc } from '@app/schema';
import { resolveSlugFromHost } from '@app/schema/utils';
import { getTenantBySlug } from '../core/spa/spa-renderer.service';
import { getIpAndUserAgent } from './ip';
import { getUserAuthContext } from '../modules/rbac/rbac.permission.service';
import { env } from '../config/env';

type AuthUserSecurityFields = {
  isActive?: boolean | null;
  is_active?: boolean | null;
};

function getRequestTenantHost(request: Request): string {
  // The browser Origin identifies the caller, not the tenant API host. Never
  // use it for authorization. Host is authoritative; Forwarded is only a
  // sanitized fallback for deployments where the proxy removes Host.
  const host = request.headers.get('host');
  if (host) return host;

  if (!env.TRUSTED_PROXY_HEADERS) return '';

  const forwarded = request.headers.get('forwarded');
  const forwardedHost = forwarded?.match(/(?:^|;)\s*host="?([^";,\s]+)"?/i)?.[1];
  return forwardedHost ?? '';
}

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
      const rawUser = user as typeof user & AuthUserSecurityFields;

      if (rawUser.isActive === false || rawUser.is_active === false) {
        set.status = 403;
        throw new ForbiddenError('La cuenta se encuentra desactivada');
      }

      if (!user.emailVerified) {
        set.status = 403;
        throw new ForbiddenError('Debes verificar tu correo electrónico antes de continuar');
      }

      // 2. Resolve company from Better Auth Organization (single source of truth)
      let resolvedCompanyId: number | null = null;
      let resolvedOrganizationId: string | null = null;
      let resolvedMembershipStatus: 'ACTIVE' | 'SUSPENDED' | 'REMOVED' | undefined;

      if (session.activeOrganizationId) {
        resolvedCompanyId = await resolveCompanyIdFromOrg(session.activeOrganizationId);
        if (resolvedCompanyId) {
          const [activeMember] = await adminDb
            .select({ status: member.status })
            .from(member)
            .where(and(
              eq(member.userId, user.id),
              eq(member.organizationId, session.activeOrganizationId),
            ))
            .limit(1);

          if (!activeMember) {
            resolvedCompanyId = null;
          } else {
            resolvedOrganizationId = session.activeOrganizationId;
            resolvedMembershipStatus = activeMember.status as 'ACTIVE' | 'SUSPENDED' | 'REMOVED';
          }
        }
      }

      // 3. Validate subdomain matches active organization & verify user membership
      const host = getRequestTenantHost(request);
      const slug = resolveSlugFromHost(host);

      if (slug) {
        const hostCompany = await getTenantBySlug(slug);

        if (hostCompany?.isActive) {
          const hostOrganizationId = hostCompany.organizationId;
          if (hostOrganizationId) {
            // Membership status is security-sensitive. Read it on every
            // request so suspension/removal takes effect immediately.
            const [membership] = await adminDb
              .select({ organizationId: member.organizationId, status: member.status })
              .from(member)
              .where(and(
                eq(member.userId, user.id),
                eq(member.organizationId, hostOrganizationId),
              ))
              .limit(1);

            resolvedCompanyId = membership ? hostCompany.id : null;
            resolvedOrganizationId = membership?.organizationId ?? null;
            resolvedMembershipStatus = membership?.status as 'ACTIVE' | 'SUSPENDED' | 'REMOVED' | undefined;
          }
        } else if (hostCompany && !hostCompany.isActive) {
          resolvedCompanyId = null;
          resolvedOrganizationId = null;
          resolvedMembershipStatus = 'SUSPENDED';
        }
      }

      // 4. Portal fallback: resolve only from an active membership, never from user.company_id.
      if (!resolvedCompanyId && !slug) {
        const memberRows = await adminDb
            .select({ orgId: member.organizationId, companyId: companies.id, status: member.status })
            .from(member)
            .innerJoin(companies, eq(companies.organization_id, member.organizationId))
            .where(eq(member.userId, user.id))
            .orderBy(asc(member.createdAt))
            .limit(2);

        const activeMemberRows = memberRows.filter(row => row.status === 'ACTIVE');
        if (activeMemberRows.length === 1) {
          resolvedCompanyId = activeMemberRows[0].companyId;
          resolvedOrganizationId = activeMemberRows[0].orgId;
          resolvedMembershipStatus = 'ACTIVE';
        }
      }

      const { ipAddress } = getIpAndUserAgent(request);

      // 5. Set tenant context in AsyncLocalStorage for the entire request lifecycle.
      // This enables auto-injection of set_config('app.current_company_id', ...)
      // inside every db.transaction() call, enforcing RLS policies automatically.
      tenantStorage.enterWith({
        companyId: resolvedCompanyId || undefined,
        organizationId: resolvedOrganizationId || undefined,
        membershipStatus: resolvedMembershipStatus,
        userId: user.id,
        sessionId: session.id,
        ipAddress: ipAddress || undefined,
      });

      const { roles, permissions } = resolvedCompanyId
        ? await getUserAuthContext(user.id, resolvedCompanyId)
        : { roles: [], permissions: [] };

      return {
        currentUserId: user.id,
        currentCompanyId: resolvedCompanyId,
        currentOrganizationId: resolvedOrganizationId,
        membershipStatus: resolvedMembershipStatus,
        currentSessionId: session.id,
        currentSession: session,
        currentRoles: roles,
        currentPermissions: permissions,
        currentUser: user,
      };
    }
  );
