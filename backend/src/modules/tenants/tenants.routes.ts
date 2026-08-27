import { Elysia, t } from 'elysia';
import { register, onboardTenant } from '../auth/auth.service';
import {
  TenantRegisterBodySchema,
  TenantOnboardBodySchema,
  TenantRegisterResponseSchema,
  TenantBrandingResponseSchema,
} from '@app/schema/backend';
import { registerRateLimit } from '../../plugins/register-rate-limit';
import { ipPlugin, getIpAndUserAgent } from '../../plugins/ip';
import { adminDb } from '../../core/db';
import { companies } from '@app/schema/tables';
import { eq } from '@app/schema';
import { resolveSlugFromHost } from '@app/schema/utils';
import { getTenantBySlug } from '../../core/spa';
import { auth } from '../../config/better-auth';
import { UnauthorizedError, DomainError } from '../../core/errors';

export const tenantRoutes = new Elysia({ prefix: '/tenants' })
  .use(ipPlugin)

  // =========================================================================
  // POST /register — New user + new tenant (email/password)
  // =========================================================================
  .post(
    '/register',
    async ({ body, request, set }) => {
      const { ipAddress, userAgent } = getIpAndUserAgent(request);
      const result = await register(body, userAgent, ipAddress);
      set.status = 201;
      return result;
    },
    {
      body: TenantRegisterBodySchema,
      response: { 201: TenantRegisterResponseSchema },
      beforeHandle: registerRateLimit as any,
    }
  )

  // =========================================================================
  // POST /onboard — Existing OAuth user → new tenant
  // =========================================================================
  .post(
    '/onboard',
    async ({ body, request, set }) => {
      const sessionData = await auth.api.getSession({
        headers: request.headers,
      });

      if (!sessionData?.user) {
        set.status = 401;
        throw new UnauthorizedError('Debes haber iniciado sesión para completar el registro de tu empresa');
      }

      const { ipAddress } = getIpAndUserAgent(request);
      const result = await onboardTenant(sessionData.user.id, body, ipAddress);
      set.status = 201;
      return result;
    },
    {
      body: TenantOnboardBodySchema,
      response: { 201: TenantRegisterResponseSchema },
      beforeHandle: registerRateLimit as any,
    }
  )

  // =========================================================================
  // GET /check-slug/:slug — Slug availability check (global scope)
  // =========================================================================
  .get('/check-slug/:slug', async ({ params }) => {
    const [existing] = await adminDb
      .select({ id: companies.id })
      .from(companies)
      .where(eq(companies.slug, params.slug))
      .limit(1);
    return { available: !existing };
  }, {
    params: t.Object({ slug: t.String() }),
    response: t.Object({ available: t.Boolean() }),
    beforeHandle: registerRateLimit as any,
  })

  // =========================================================================
  // GET /check-ruc/:ruc — RUC availability check (global scope)
  // =========================================================================
  .get('/check-ruc/:ruc', async ({ params }) => {
    const [existing] = await adminDb
      .select({ id: companies.id })
      .from(companies)
      .where(eq(companies.ruc, params.ruc))
      .limit(1);
    return { available: !existing };
  }, {
    params: t.Object({ ruc: t.String() }),
    response: t.Object({ available: t.Boolean() }),
    beforeHandle: registerRateLimit as any,
  })

  // =========================================================================
  // GET /check-domain — Domain registration validation (Caddy/proxy use)
  // =========================================================================
  .get('/check-domain', async ({ query, set }) => {
    const domain = query.domain;
    if (!domain) {
      throw new DomainError('domain query parameter is required', 400);
    }

    const parts = domain.split('.');
    const slug = parts[0];

    if (slug === 'api' || parts.length < 3) {
      throw new DomainError('System domain or main domain bypass', 400);
    }

    const [existing] = await adminDb
      .select({ id: companies.id })
      .from(companies)
      .where(eq(companies.slug, slug))
      .limit(1);

    if (!existing) {
      throw new DomainError('Domain not registered', 404);
    }

    return { status: 'ok' };
  }, {
    query: t.Object({ domain: t.String() }),
    response: t.Object({ status: t.String() }),
    beforeHandle: registerRateLimit as any,
  })

  // =========================================================================
  // GET /tenant-info — Tenant branding for login page (public, cached)
  // =========================================================================
  .get('/tenant-info', async ({ query, request }) => {
    const host = request.headers.get('host') || '';
    const slug = query.slug || resolveSlugFromHost(host);

    if (!slug) {
      throw new DomainError('No tenant slug resolved from query or Host header', 400);
    }

    const company = await getTenantBySlug(slug);

    if (!company || !company.isActive) {
      throw new DomainError('Tenant not found or inactive', 404);
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
    query: t.Object({ slug: t.Optional(t.String()) }),
    response: TenantBrandingResponseSchema,
    afterHandle: ({ set }) => {
      set.headers['cache-control'] = 'public, max-age=60, s-maxage=120, stale-while-revalidate=300';
    },
  })

  // =========================================================================
  // GET /tenant-manifest — PWA manifest.json per tenant (public, cached)
  // =========================================================================
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
    set.headers['cache-control'] = 'public, max-age=3600, s-maxage=7200, stale-while-revalidate=86400';

    return {
      name: companyName,
      short_name: shortName,
      start_url: `/`,
      display: 'standalone',
      background_color: '#ffffff',
      theme_color: primaryColor,
      icons: [
        {
          src: logoUrl,
          sizes: '192x192',
          type: 'image/webp',
          purpose: 'any maskable'
        },
        {
          src: logoUrl,
          sizes: '512x512',
          type: 'image/webp',
          purpose: 'any maskable'
        }
      ]
    };
  }, {
    query: t.Object({ slug: t.Optional(t.String()) }),
  });
