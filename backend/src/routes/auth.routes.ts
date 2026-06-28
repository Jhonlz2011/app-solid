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
  verifyEmail,
  resendVerification,
} from '../services/auth.service';
import { AuthRegisterDto, AuthLoginDto, AuthChangePasswordDto, AuthUpdateProfileDto, AuthResponseDto, AuthUserResponse, TenantBrandingResponseDto } from '@app/schema/backend';
import { authGuard } from '../plugins/auth-guard';
import { loginRateLimit, resetLoginAttempts } from '../plugins/login-rate-limit';
import { registerRateLimit } from '../plugins/register-rate-limit';
import { COOKIE_OPTIONS } from '../config/auth';
import { ipPlugin, getIpAndUserAgent } from '../plugins/ip';
import { db, adminDb } from '../db';
import { companies } from '@app/schema/tables';
import { eq } from '@app/schema';
import { resolveSlugFromHost } from '@app/schema/utils';
import { getTenantBySlug } from '../services/spa-renderer.service';

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
    beforeHandle: registerRateLimit as any,
  })
  .get('/check-ruc/:ruc', async ({ params }) => {
    const [existing] = await db.select({ id: companies.id }).from(companies).where(eq(companies.ruc, params.ruc)).limit(1);
    return { available: !existing };
  }, {
    params: t.Object({ ruc: t.String() }),
    response: t.Object({ available: t.Boolean() }),
    beforeHandle: registerRateLimit as any,
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
    beforeHandle: registerRateLimit as any,
  })
  // SEC-01: discover-tenants endpoint REMOVED — tenant selection now happens post-auth
  .post(
    '/login',
    async ({ body, cookie, request }) => {
      const { ipAddress, userAgent } = getIpAndUserAgent(request);
      if (process.env.NODE_ENV !== 'production') {
        console.log('Login attempt:', { email: body.email, userAgent, ipAddress });
      }

      let companyId = body.companyId;
      if (!companyId) {
        const host = request.headers.get('host') || '';
        let slug = resolveSlugFromHost(host);

        // Fallback: Si el host no devolvió un slug de tenant (ej. es el endpoint api.zelys.app),
        // resolvemos a partir de la URL de origen en el header Referer
        if (!slug) {
          const referer = request.headers.get('referer');
          if (referer) {
            try {
              const refUrl = new URL(referer);
              const querySlug = refUrl.searchParams.get('slug');
              slug = resolveSlugFromHost(refUrl.host, querySlug);
            } catch (e) {
              // Ignorar URLs inválidas
            }
          }
        }

        if (slug) {
          const [company] = await adminDb
            .select({ id: companies.id })
            .from(companies)
            .where(eq(companies.slug, slug))
            .limit(1);
          if (company) {
            companyId = company.id;
          }
        }
      }

          const loginResult = await login(body.email, body.password, userAgent, ipAddress, companyId, body.turnstileToken);

      if ('requiresTenantSelection' in loginResult && loginResult.requiresTenantSelection) {
        return loginResult;
      }

      // Reset rate limit on success
      await resetLoginAttempts(request);

      // Set session cookie (httpOnly — browser sends automatically)
      cookie.session.set({
        value: loginResult.sessionId,
        ...COOKIE_OPTIONS,
      });

      // Notification is now handled internally by login() service
      return loginResult;
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
  .post('/verify-email', async ({ body }) => {
    return await verifyEmail(body.token);
  }, {
    body: t.Object({ token: t.String() }),
    response: t.Object({ success: t.Boolean() }),
  })
  .get('/tenant-info', async ({ query, request, set }) => {
    const host = request.headers.get('host') || '';
    const slug = query.slug || resolveSlugFromHost(host);

    if (!slug) {
      set.status = 400;
      throw new Error('No tenant slug resolved from query or Host header');
    }

    const company = await getTenantBySlug(slug);

    if (!company || !company.isActive) {
      set.status = 404;
      throw new Error('Tenant not found or inactive');
    }

    return {
      id: company.id,
      slug: company.slug,
      businessName: company.businessName,
      tradeName: company.tradeName,
      logoUrl: company.logoUrl,
      primaryColor: company.primaryColor,
      themeColor: company.themeColor,
      loginBgUrl: company.loginBgUrl,
    };
  }, {
    query: t.Object({
      slug: t.Optional(t.String()),
    }),
    response: TenantBrandingResponseDto,
  })
  .get('/tenant-manifest', async ({ query, request, set }) => {
    const host = request.headers.get('host') || '';
    const slug = query.slug || resolveSlugFromHost(host);

    let companyName = 'Zelys ERP';
    let shortName = 'Zelys';
    let primaryColor = '#2563eb';
    let logoUrl = '/android-chrome-192x192.png';

    if (slug) {
      const company = await getTenantBySlug(slug);

      if (company) {
        companyName = company.businessName;
        shortName = company.tradeName || company.businessName;
        primaryColor = company.primaryColor;
        logoUrl = company.logoUrl || logoUrl;
      }
    }

    set.headers['content-type'] = 'application/manifest+json; charset=utf-8';
    
    return {
      name: companyName,
      short_name: shortName,
      start_url: `https://${host}/`,
      display: 'standalone',
      background_color: '#ffffff',
      theme_color: primaryColor,
      icons: [
        {
          src: logoUrl,
          sizes: '192x192',
          type: 'image/png',
          purpose: 'any maskable'
        },
        {
          src: logoUrl,
          sizes: '512x512',
          type: 'image/png',
          purpose: 'any maskable'
        }
      ]
    };
  }, {
    query: t.Object({
      slug: t.Optional(t.String()),
    }),
  })
  // Protected Routes Group
  .group('', (app) => app
    .use(authGuard)
    .get('/me', async ({ currentUserId, currentSessionId }) => {
      const user = await getMe(currentUserId);
      return { ...user, sessionId: currentSessionId };
    }, {
      response: t.Composite([AuthUserResponse, t.Object({ sessionId: t.String() })]),
    })
    .post('/resend-verification', async ({ currentUserId, currentCompanyId }) => {
      return await resendVerification(currentUserId, currentCompanyId);
    }, {
      response: t.Object({ success: t.Boolean(), retryAfter: t.Optional(t.Number()) }),
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
