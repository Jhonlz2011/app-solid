import { Elysia, t } from 'elysia';
import {
  register,
  login,
  rotateRefreshToken,
  logout,
  getMe,
  changePassword,
  getActiveSessions,
  revokeSession,
  AuthError,
} from '../services/auth.service';
import { authGuard } from '../plugins/auth-guard';
import { loginRateLimit } from '../plugins/login-rate-limit';
import { serialize, parse as parseCookie } from 'cookie';

const FRONTEND_URL = process.env.FRONTEND_URL ?? 'http://localhost:5173';
const COOKIE_DOMAIN = (() => {
  try {
    return new URL(FRONTEND_URL).hostname;
  } catch {
    return undefined;
  }
})();

const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: process.env.NODE_ENV === 'production' ? ('strict' as const) : ('lax' as const),
  path: '/api/auth',
  domain: COOKIE_DOMAIN === 'localhost' ? undefined : COOKIE_DOMAIN,
  maxAge: 60 * 60 * 24 * Number(process.env.REFRESH_TOKEN_EXP_DAYS ?? 14),
};

export const authRoutes = new Elysia({ prefix: '/auth' })
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
      body: t.Object({
        email: t.String({ format: 'email' }),
        password: t.String({ minLength: 8 }),
        username: t.Optional(t.String({ minLength: 3 })),
      }),
    }
  )
  .use(loginRateLimit)
  .post(
    '/login',
    async ({ body, set, request }) => {
      const userAgent = request.headers.get('user-agent') || 'Desconocido';

      // Improved IP extraction
      let ipAddress = request.headers.get('x-forwarded-for')?.split(',')[0].trim();
      if (!ipAddress) {
        ipAddress = request.headers.get('x-real-ip') || undefined;
      }
      // Fallback for local development if no headers present or localhost/private IP
      const isPrivateIP = !ipAddress || ipAddress === '::1' || ipAddress === '127.0.0.1' || ipAddress.startsWith('192.168.') || ipAddress.startsWith('10.');

      if (isPrivateIP && process.env.NODE_ENV !== 'production') {
        ipAddress = '157.100.108.123'; // Public IP for testing location (Guayaquil)
      }

      console.log('Login attempt:', { email: body.email, userAgent, ipAddress, env: process.env.NODE_ENV });

      const { user, accessToken, refreshToken } = await login(body.email, body.password, userAgent, ipAddress);

      set.headers = {
        'Access-Control-Allow-Origin': FRONTEND_URL,
        'Access-Control-Allow-Credentials': 'true',
        'Set-Cookie': serialize('refresh_token', refreshToken, COOKIE_OPTIONS),
      };

      return { accessToken, user };
    },
    {
      body: t.Object({
        email: t.String(), // Can be email or username
        password: t.String(),
      }),
    }
  )
  .post('/refresh', async ({ request, set }) => {
    const cookies = parseCookie(request.headers.get('cookie') || '');
    const refreshToken = cookies.refresh_token;

    if (!refreshToken) {
      set.status = 401;
      return { error: 'No se proporcionó el token de refresco' };
    }

    const result = await rotateRefreshToken(refreshToken);

    const headers: Record<string, string> = {
      'Access-Control-Allow-Origin': FRONTEND_URL,
      'Access-Control-Allow-Credentials': 'true',
    };

    // Only set cookie if a new refresh token was issued
    if (result.refreshToken) {
      headers['Set-Cookie'] = serialize('refresh_token', result.refreshToken, COOKIE_OPTIONS);
    }

    set.headers = headers;

    return { accessToken: result.accessToken };
  })
  .post('/logout', async ({ request, set }) => {
    try {
      const cookies = parseCookie(request.headers.get('cookie') || '');
      const refreshToken = cookies.refresh_token;

      if (refreshToken && refreshToken.includes('.')) {
        try {
          await logout(refreshToken.split('.')[0]);
        } catch (error) {
          console.warn('Error al revocar token:', error);
        }
      }

      set.headers = {
        'Access-Control-Allow-Origin': FRONTEND_URL,
        'Access-Control-Allow-Credentials': 'true',
        'Set-Cookie': serialize('refresh_token', '', {
          ...COOKIE_OPTIONS,
          maxAge: 0,
          expires: new Date(0),
        }),
      };

      return { success: true };
    } catch (error) {
      console.error('Error en logout:', error);
      set.headers = {
        'Access-Control-Allow-Origin': FRONTEND_URL,
        'Access-Control-Allow-Credentials': 'true',
        'Set-Cookie': serialize('refresh_token', '', {
          ...COOKIE_OPTIONS,
          maxAge: 0,
          expires: new Date(0),
        }),
      };
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
        body: t.Object({
          currentPassword: t.String(),
          newPassword: t.String({ minLength: 8 }),
        }),
      }
    )
    .get('/sessions', async ({ currentUserId, request }) => {
      const cookies = parseCookie(request.headers.get('cookie') || '');
      const refreshToken = cookies.refresh_token;
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
