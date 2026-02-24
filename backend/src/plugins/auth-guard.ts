import { Elysia } from 'elysia';
import { UnauthorizedError } from '../services/errors';
import { validateSession } from '../services/auth.service';
import { getUserRoles, getUserPermissions } from '../services/rbac.service';
import { COOKIE_OPTIONS } from '../config/auth';

export const authGuard = (app: Elysia) => app
  .derive(
    async ({ cookie, set }) => {
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

      const { session, shouldRefreshCookie } = result;

      // Rolling session: update cookie expiry if session was extended
      if (shouldRefreshCookie) {
        cookie.session.set({
          value: sessionId,
          ...COOKIE_OPTIONS,
        });
      }

      // Fetch roles/permissions (cached in Redis via rbac.service)
      const [roles, permissions] = await Promise.all([
        getUserRoles(session.user_id),
        getUserPermissions(session.user_id),
      ]);

      return {
        currentUserId: session.user_id,
        currentSessionId: sessionId,
        currentRoles: roles,
        currentPermissions: permissions,
      };
    }
  );
