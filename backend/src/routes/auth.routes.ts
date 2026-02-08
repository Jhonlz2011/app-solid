import { Elysia, t } from 'elysia';
import {
  register,
  login,
  rotateRefreshToken,
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
    // Handle AuthError (custom)
    if (error instanceof AuthError) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: error.code,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Handle Elysia validation errors
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
      console.log('Login attempt:', { email: body.email, userAgent, ipAddress, env: process.env.NODE_ENV });
      const { user, accessToken, refreshToken } = await login(body.email, body.password, userAgent, ipAddress);

      // Reset rate limit on success
      resetLoginAttempts(request);

      cookie.refresh_token.set({
        value: refreshToken,
        ...COOKIE_OPTIONS,
      });

      return { accessToken, user };
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
  .post('/refresh', async ({ cookie, set }) => {
    const refreshToken = cookie.refresh_token.value as string | undefined;

    if (!refreshToken) {
      set.status = 401;
      return { error: 'No se proporcionó el token de refresco' };
    }

    const result = await rotateRefreshToken(refreshToken);

    // Only set cookie if a new refresh token was issued
    if (result.refreshToken) {
      cookie.refresh_token.set({
        value: result.refreshToken,
        ...COOKIE_OPTIONS,
      });
    }

    return { accessToken: result.accessToken };
  })
  .post('/logout', async ({ cookie }) => {
    try {
      const refreshToken = cookie.refresh_token.value as string | undefined;

      if (refreshToken && refreshToken.includes('.')) {
        try {
          await logout(refreshToken.split('.')[0]);
        } catch (error) {
          console.warn('Error al revocar token:', error);
        }
      }

      cookie.refresh_token.set({
        ...COOKIE_OPTIONS,
        value: '',
        maxAge: 0,
        expires: new Date(0),
      });

      return { success: true };
    } catch (error) {
      console.error('Error en logout:', error);
      cookie.refresh_token.set({
        ...COOKIE_OPTIONS,
        value: '',
        maxAge: 0,
        expires: new Date(0),
      });
      return { success: true };
    }
  })
  // Protected Routes Group
  .group('', (app) => app
    .use(authGuard)
    .get('/me', ({ currentUserId }) => getMe(currentUserId))
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
    .get('/sessions', async ({ currentUserId, cookie }) => {
      const refreshToken = cookie.refresh_token.value as string | undefined;
      const currentSelector = refreshToken?.includes('.') ? refreshToken.split('.')[0] : undefined;
      return getActiveSessions(currentUserId, currentSelector);
    })
    .delete('/sessions/:id', async ({ currentUserId, params }) => {
      const sessionId = parseInt(params.id, 10);
      if (isNaN(sessionId)) {
        throw new AuthError('ID de sesión inválido', 400);
      }
      return revokeSession(sessionId, currentUserId);
    })
  );
