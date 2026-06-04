import { Elysia, t } from 'elysia';
import {
  register,
  login,
  logout,
  getMe,
  changePassword,
  updateProfile,
  getActiveSessions,
  revokeSession,
} from '../services/auth.service';
import { AuthRegisterDto, AuthLoginDto, AuthChangePasswordDto, AuthUpdateProfileDto, AuthResponseDto } from '@app/schema/backend';
import { authGuard } from '../plugins/auth-guard';
import { loginRateLimit, resetLoginAttempts } from '../plugins/login-rate-limit';
import { registerRateLimit } from '../plugins/register-rate-limit';
import { COOKIE_OPTIONS } from '../config/auth';
import { ipPlugin, getIpAndUserAgent } from '../plugins/ip';
import { db } from '../db';
import { companies } from '@app/schema/tables';
import { eq } from '@app/schema';

export const authRoutes = new Elysia({ prefix: '/auth' })
  .use(ipPlugin)
  .post(
    '/register',
    async ({ body, cookie, request, set }) => {
      const { ipAddress, userAgent } = getIpAndUserAgent(request);
      const result = await register(body, userAgent, ipAddress);

      // Auto-login: set session cookie
      cookie.session.set({
        value: result.sessionId,
        ...COOKIE_OPTIONS,
      });

      set.status = 201;
      return { user: result.user, sessionId: result.sessionId };
    },
    {
      body: AuthRegisterDto,
      response: { 201: AuthResponseDto },
      beforeHandle: registerRateLimit as any,
    }
  )
  .get('/check-slug/:slug', async ({ params }) => {
    const [existing] = await db.select({ id: companies.id }).from(companies).where(eq(companies.slug, params.slug)).limit(1);
    return { available: !existing };
  }, {
    params: t.Object({ slug: t.String() }),
    response: t.Object({ available: t.Boolean() }),
  })
  .get('/check-ruc/:ruc', async ({ params }) => {
    const [existing] = await db.select({ id: companies.id }).from(companies).where(eq(companies.ruc, params.ruc)).limit(1);
    return { available: !existing };
  }, {
    params: t.Object({ ruc: t.String() }),
    response: t.Object({ available: t.Boolean() }),
  })
  .get('/check-domain', async ({ query, set }) => {
    const domain = query.domain;
    if (!domain) {
      set.status = 400;
      return 'domain query parameter is required';
    }

    const parts = domain.split('.');
    const slug = parts[0];

    if (slug === 'api' || parts.length < 3) {
      set.status = 400;
      return 'System domain or main domain bypass';
    }

    const [existing] = await db
      .select({ id: companies.id })
      .from(companies)
      .where(eq(companies.slug, slug))
      .limit(1);

    if (!existing) {
      set.status = 404;
      return 'Domain not registered';
    }

    set.status = 200;
    return 'OK';
  }, {
    query: t.Object({
      domain: t.String(),
    }),
  })
  .post(
    '/login',
    async ({ body, cookie, request }) => {
      const { ipAddress, userAgent } = getIpAndUserAgent(request);
      if (process.env.NODE_ENV !== 'production') {
        console.log('Login attempt:', { email: body.email, userAgent, ipAddress });
      }
      const { user, sessionId: newSessionId } = await login(body.email, body.password, userAgent, ipAddress);

      // Reset rate limit on success
      await resetLoginAttempts(request);

      // Set session cookie (httpOnly — browser sends automatically)
      cookie.session.set({
        value: newSessionId,
        ...COOKIE_OPTIONS,
      });

      // Notification is now handled internally by login() service
      return { user, sessionId: newSessionId };
    },
    {
      body: AuthLoginDto,
      response: {
        200: AuthResponseDto,
        429: t.Object({
          error: t.String(),
          retryAfter: t.Number(),
        }),
      },
      beforeHandle: loginRateLimit as any,
    }
  )
  .post('/logout', async ({ cookie }) => {
    const sessionId = cookie.session?.value as string | undefined;
    try {
      if (sessionId) {
        await logout(sessionId);
      }
    } catch (error) {
      console.warn('Error al revocar sesión:', error);
    } finally {
      cookie.session.set({
        ...COOKIE_OPTIONS,
        value: '',
        maxAge: 0,
        expires: new Date(0),
      });
    }
    return { success: true };
  })
  // Protected Routes Group
  .group('', (app) => app
    .use(authGuard)
    .get('/me', async ({ currentUserId, currentSessionId }) => {
      const user = await getMe(currentUserId);
      return { ...user, sessionId: currentSessionId };
    }, {
      response: t.Object({
        id: t.Number(),
        companyId: t.Number(),
        email: t.String(),
        username: t.String(),
        entityId: t.Union([t.Number(), t.Null()]),
        isActive: t.Union([t.Boolean(), t.Null()]),
        lastLogin: t.Union([t.Date(), t.Null()]),
        roles: t.Array(t.String()),
        permissions: t.Array(t.String()),
        entity: t.Optional(t.Object({
          id: t.Number(),
          businessName: t.String(),
          isClient: t.Boolean(),
          isSupplier: t.Boolean(),
          isEmployee: t.Boolean(),
        })),
        sessionId: t.String(),
      }),
    })
    .post(
      '/change-password',
      async ({ body, currentUserId }) => {
        return changePassword(currentUserId, body.currentPassword, body.newPassword);
      },
      {
        body: AuthChangePasswordDto,
        response: t.Object({ success: t.Literal(true) }),
      }
    )
    .put(
      '/profile',
      async ({ body, currentUserId }) => {
        const result = await updateProfile(currentUserId, body);
        return result;
      },
      {
        body: AuthUpdateProfileDto,
        response: t.Object({
          success: t.Literal(true),
          message: t.Optional(t.String()),
          user: t.Optional(t.Object({
            id: t.Number(),
            email: t.String(),
            username: t.String(),
          })),
        }),
      }
    )
    .get('/sessions', async ({ currentUserId, currentSessionId }) => {
      return getActiveSessions(currentUserId, currentSessionId);
    }, {
      response: t.Array(t.Object({
        id: t.String(),
        user_agent: t.Union([t.String(), t.Null()]),
        ip_address: t.Union([t.String(), t.Null()]),
        location: t.Union([t.String(), t.Null()]),
        created_at: t.Date(),
        is_current: t.Boolean(),
      })),
    })
    .delete('/sessions/:id', async ({ currentUserId, params }) => {
      const result = await revokeSession(params.id, currentUserId);
      return result;
    }, {
      response: t.Object({ success: t.Literal(true) }),
    })
  );
