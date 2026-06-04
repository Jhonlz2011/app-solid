import { Elysia } from 'elysia';
import { UnauthorizedError } from '../services/errors';
import { validateSession } from '../services/auth.service';
import { COOKIE_OPTIONS } from '../config/auth';
import { db, tenantStorage } from '../db';
import { companies } from '@app/schema/tables';
import { eq } from '@app/schema';

export const authGuard = (app: Elysia) => app
  .derive(
    async ({ cookie, set, request }) => {
      // 1. Resolve host and check subdomain
      const host = request.headers.get('host') || '';
      let slug: string | null = null;
      let hostCompanyId: number | null = null;

      if (host.includes('zelys.app')) {
        const parts = host.split('.');
        if (parts.length > 2 && parts[0] !== 'api') {
          slug = parts[0];
        }
      } else {
        const parts = host.split('.');
        if (parts.length > 1 && !host.startsWith('localhost') && !host.startsWith('127.0.0.1')) {
          slug = parts[0];
        }
      }

      if (slug) {
        const [comp] = await db
          .select({ id: companies.id })
          .from(companies)
          .where(eq(companies.slug, slug))
          .limit(1);
        if (comp) {
          hostCompanyId = comp.id;
        }
      }

      const sessionId = cookie.session?.value as string | undefined;

      if (!sessionId) {
        set.status = 401;
        throw new UnauthorizedError('Sesión requerida');
      }

      const result = await validateSession(sessionId);
      if (!result) {
        // Clear invalid/expired cookie
        cookie.session.set({
          ...COOKIE_OPTIONS,
          value: '',
          maxAge: 0,
          expires: new Date(0),
        });
        set.status = 401;
        throw new UnauthorizedError('Sesión expirada o inválida');
      }

      const { session, roles, permissions, shouldRefreshCookie } = result;

      // Strict validation: check that user session matches the requested subdomain
      if (hostCompanyId && session.company_id !== hostCompanyId) {
        set.status = 403;
        throw new UnauthorizedError('Acceso denegado a este inquilino');
      }

      // Rolling session: update cookie expiry if session was extended
      if (shouldRefreshCookie) {
        cookie.session.set({
          value: sessionId,
          ...COOKIE_OPTIONS,
        });
      }

      const resolvedCompanyId = hostCompanyId || session.company_id;
      const ipAddress = request.headers.get('x-forwarded-for')
        || request.headers.get('x-real-ip')
        || undefined;

      // Set tenant context in AsyncLocalStorage for the entire request lifecycle.
      // This enables auto-injection of set_config('app.current_company_id', ...)
      // inside every db.transaction() call, enforcing RLS policies automatically.
      tenantStorage.enterWith({
        companyId: resolvedCompanyId,
        userId: session.user_id,
        ipAddress: ipAddress || undefined,
      });

      return {
        currentUserId: session.user_id,
        currentCompanyId: resolvedCompanyId,
        currentSessionId: sessionId,
        currentRoles: roles,
        currentPermissions: permissions,
      };
    }
  );
