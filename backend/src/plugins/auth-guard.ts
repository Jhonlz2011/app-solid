import { Elysia } from 'elysia';
import { UnauthorizedError, ForbiddenError } from '../services/errors';
import { validateSession } from '../services/auth.service';
import { COOKIE_OPTIONS } from '../config/auth';
import { db, adminDb, tenantStorage } from '../db';
import { companies } from '@app/schema/tables';
import { eq } from '@app/schema';
import { resolveSlugFromHost } from '@app/schema/utils';
import { getIpAndUserAgent } from './ip';

export const authGuard = (app: Elysia) => app
  .derive(
    async ({ cookie, set, request }) => {
      // 1. Resolve host and check subdomain
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
      const { ipAddress } = getIpAndUserAgent(request);

      // Seguridad Perimetral: Si el email no está verificado, bloquear acceso a recursos
      // excepto las rutas básicas de auth y reenvío de correo
      const isAuthUtility = request.url.includes('/api/auth/me') ||
                            request.url.includes('/api/auth/logout') ||
                            request.url.includes('/api/auth/resend-verification');
                            
      if (!result.emailVerified && !isAuthUtility) {
        set.status = 403;
        throw new ForbiddenError('Debes verificar tu correo electrónico para acceder a los servicios.');
      }

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
