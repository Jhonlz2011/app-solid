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
  AuthError,
} from '../services/auth.service';
import { AuthRegisterDto, AuthLoginDto, AuthChangePasswordDto, AuthUpdateProfileDto, AuthResponseDto } from '@app/schema/backend';
import { authGuard } from '../plugins/auth-guard';
import { loginRateLimit, resetLoginAttempts } from '../plugins/login-rate-limit';
import { COOKIE_OPTIONS } from '../config/auth';
import { ipPlugin, getIpAndUserAgent } from '../plugins/ip';

export const authRoutes = new Elysia({ prefix: '/auth' })
  .use(ipPlugin)
  .onError(({ error, code }) => {
    if (error instanceof AuthError) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: error.code,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (code === 'VALIDATION') {
      return new Response(
        JSON.stringify({ error: 'Datos inválidos', details: error.message }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    console.error('Auth error:', error);
    return new Response(
      JSON.stringify({ error: 'Error interno del servidor' }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  })
  .post(
    '/register',
    async ({ body, set }) => {
      const user = await register(body.email, body.password, body.username);
      set.status = 201;
      return { user: { id: user.id, email: user.email, username: user.username } };
    },
    {
      body: AuthRegisterDto
    }
  )
  .post(
    '/login',
    async ({ body, cookie, request }) => {
      const { ipAddress, userAgent } = getIpAndUserAgent(request);
      if (process.env.NODE_ENV !== 'production') {
        console.log('Login attempt:', { email: body.email, userAgent, ipAddress });
      }
      const { user, sessionId: newSessionId, expiresAt } = await login(body.email, body.password, userAgent, ipAddress);

      // Reset rate limit on success
      await resetLoginAttempts(request);

      // Set session cookie (httpOnly — browser sends automatically)
      cookie.session.set({
        value: newSessionId,
        ...COOKIE_OPTIONS,
      });

      // Response: user data + session ID (needed for WS revoke comparison)
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
      if (sessionId) await logout(sessionId);
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
    })
    .post(
      '/change-password',
      async ({ body, currentUserId }) => {
        return changePassword(currentUserId, body.currentPassword, body.newPassword);
      },
      {
        body: AuthChangePasswordDto,
      }
    )
    .put(
      '/profile',
      async ({ body, currentUserId }) => {
        return updateProfile(currentUserId, body);
      },
      {
        body: AuthUpdateProfileDto,
      }
    )
    .get('/sessions', async ({ currentUserId, currentSessionId }) => {
      return getActiveSessions(currentUserId, currentSessionId);
    })
    .delete('/sessions/:id', async ({ currentUserId, params }) => {
      // Session IDs are now text (base64url), not numeric
      return revokeSession(params.id, currentUserId);
    })
  );
