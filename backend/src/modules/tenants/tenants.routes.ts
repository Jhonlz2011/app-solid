import { Elysia, t } from 'elysia';
import { register, onboardTenant } from '../auth/auth.service';
import { acceptUserInvitation } from '../rbac/rbac.users.service';
import {
  TenantRegisterBodySchema,
  TenantOnboardBodySchema,
  TenantRegisterResponseSchema,
  TenantBrandingResponseSchema,
  RbacAcceptInvitationBodySchema,
  RbacAcceptInvitationResponseSchema,
  TenantHandoffRequestBodySchema,
  TenantHandoffRequestResponseSchema,
  TenantHandoffConsumeQuerySchema,
  TenantHandoffConsumeResponseSchema,
} from '@app/schema/backend';
import { registerRateLimit, checkRateLimit } from '../../plugins/rate-limit';
import { ipPlugin, getIpAndUserAgent } from '../../plugins/ip';
import { adminDb } from '../../core/db';
import { companies, user, member, sessions } from '@app/schema/tables';
import { eq, and } from '@app/schema';
import { resolveSlugFromHost, normalizeTenantSlug, buildTenantUrl } from '@app/schema/utils';
import { getTenantBySlug } from '../../core/spa';
import { auth } from '../../config/better-auth';
import { UnauthorizedError, DomainError } from '../../core/errors';
import { env } from '../../config/env';
import { redis } from '../../core/cache/redis';
import { createHash, createHmac, randomUUID, timingSafeEqual } from 'node:crypto';

const HANDOFF_TTL_SECONDS = 60;
const CONSUME_HANDOFF_SCRIPT = `
local value = redis.call('GET', KEYS[1])
if not value then return false end
redis.call('DEL', KEYS[1])
return value
`;

type HandoffPayload = {
  userId: string;
  organizationId: string;
  destinationSlug: string;
  nonce: string;
  expiresAt: number;
};

function signHandoff(payload: HandoffPayload): string {
  const encoded = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = createHmac('sha256', env.BETTER_AUTH_SECRET)
    .update(encoded)
    .digest('base64url');
  return `${encoded}.${signature}`;
}

function verifyHandoff(ticket: string): HandoffPayload | null {
  const [encoded, signature] = ticket.split('.');
  if (!encoded || !signature) return null;
  const expected = createHmac('sha256', env.BETTER_AUTH_SECRET)
    .update(encoded)
    .digest('base64url');
  if (expected.length !== signature.length || !timingSafeEqual(Buffer.from(expected), Buffer.from(signature))) return null;
  try {
    const payload = JSON.parse(Buffer.from(encoded, 'base64url').toString()) as HandoffPayload;
    return payload.expiresAt > Date.now() ? payload : null;
  } catch {
    return null;
  }
}

function handoffRedisKey(ticket: string): string {
  return `auth:tenant-handoff:${createHash('sha256').update(ticket).digest('hex')}`;
}

export const tenantRoutes = new Elysia({ prefix: '/tenants' })
  .use(ipPlugin)

  // =========================================================================
  // POST /accept-invitation — Accept organization invitation & set password
  // =========================================================================
  .post(
    '/accept-invitation',
    async ({ body, set }) => {
      const result = await acceptUserInvitation(body);
      set.status = 200;
      return result;
    },
    {
      body: RbacAcceptInvitationBodySchema,
      response: { 200: RbacAcceptInvitationResponseSchema },
    }
  )

  // =========================================================================
  // POST /handoff/request — short-lived, one-use tenant handoff ticket
  // =========================================================================
  .post(
    '/handoff/request',
    async ({ body, request }) => {
      const sessionData = await auth.api.getSession({ headers: request.headers });
      const sessionUser = sessionData?.user as (typeof sessionData extends null ? never : { isActive?: boolean; is_active?: boolean; emailVerified?: boolean });
      if (!sessionData?.user || sessionUser?.isActive === false || sessionUser?.is_active === false || sessionUser?.emailVerified !== true) {
        throw new UnauthorizedError('La sesión no está habilitada para cambiar de empresa');
      }

      const destinationSlug = normalizeTenantSlug(body.destinationSlug);
      if (!destinationSlug) throw new DomainError('Destino de tenant inválido', 400);

      const [company] = await adminDb
        .select({ id: companies.id, organizationId: companies.organization_id, slug: companies.slug })
        .from(companies)
        .where(and(
          eq(companies.organization_id, body.organizationId),
          eq(companies.slug, destinationSlug),
        ))
        .limit(1);
      if (!company?.organizationId) throw new DomainError('La empresa solicitada no existe', 404);

      const [membership] = await adminDb
        .select({ id: member.id })
        .from(member)
        .where(and(
          eq(member.organizationId, company.organizationId),
          eq(member.userId, sessionData.user.id),
          eq(member.status, 'ACTIVE'),
        ))
        .limit(1);
      if (!membership) throw new DomainError('No perteneces a esta empresa', 403);

      const payload: HandoffPayload = {
        userId: sessionData.user.id,
        organizationId: company.organizationId,
        destinationSlug,
        nonce: randomUUID(),
        expiresAt: Date.now() + HANDOFF_TTL_SECONDS * 1000,
      };
      const ticket = signHandoff(payload);
      const stored = await redis.set(handoffRedisKey(ticket), JSON.stringify(payload), 'EX', HANDOFF_TTL_SECONDS, 'NX');
      if (stored !== 'OK') throw new DomainError('No se pudo crear el handoff de tenant', 503);

      return {
        ticket,
        redirectUrl: buildTenantUrl(destinationSlug, '/dashboard', { queryParams: { handoff: ticket } }),
        expiresInSeconds: HANDOFF_TTL_SECONDS,
      };
    },
    {
      body: TenantHandoffRequestBodySchema,
      response: TenantHandoffRequestResponseSchema,
    }
  )

  // =========================================================================
  // GET /handoff/consume — validates and consumes the ticket exactly once
  // =========================================================================
  .get(
    '/handoff/consume',
    async ({ query, request }) => {
      const sessionData = await auth.api.getSession({ headers: request.headers });
      if (!sessionData?.user || sessionData.user.emailVerified !== true) {
        throw new UnauthorizedError('La sesión no está habilitada para cambiar de empresa');
      }

      const signedPayload = verifyHandoff(query.ticket);
      if (!signedPayload || signedPayload.userId !== sessionData.user.id) {
        throw new DomainError('El handoff es inválido o expiró', 401);
      }

      const key = handoffRedisKey(query.ticket);
      // GET + DEL is not safe under concurrent requests. Consume atomically
      // so the one-use guarantee survives races across API instances.
      const storedRaw = await redis.eval(CONSUME_HANDOFF_SCRIPT, 1, key) as string | null | false;
      if (!storedRaw) throw new DomainError('El handoff ya fue utilizado o expiró', 401);

      const storedPayload = JSON.parse(String(storedRaw)) as HandoffPayload;
      if (storedPayload.nonce !== signedPayload.nonce || storedPayload.organizationId !== signedPayload.organizationId) {
        throw new DomainError('El handoff es inválido', 401);
      }

      const [company] = await adminDb
        .select({ id: companies.id, slug: companies.slug, organizationId: companies.organization_id })
        .from(companies)
        .where(eq(companies.organization_id, signedPayload.organizationId))
        .limit(1);
      const [membership] = company?.organizationId
        ? await adminDb
          .select({ id: member.id })
          .from(member)
          .where(and(
            eq(member.organizationId, company.organizationId),
            eq(member.userId, sessionData.user.id),
            eq(member.status, 'ACTIVE'),
          ))
          .limit(1)
        : [];
      if (!company?.organizationId || company.slug !== signedPayload.destinationSlug || !membership) {
        throw new DomainError('La membresía del tenant no está activa', 403);
      }

      await adminDb
        .update(sessions)
        .set({ activeOrganizationId: company.organizationId })
        .where(and(
          eq(sessions.id, sessionData.session.id),
          eq(sessions.userId, sessionData.user.id),
        ));

      return {
        organizationId: company.organizationId,
        companyId: company.id,
        slug: company.slug,
      };
    },
    {
      query: TenantHandoffConsumeQuerySchema,
      response: TenantHandoffConsumeResponseSchema,
    }
  )

  // =========================================================================
  // POST /register — New user + new tenant (email/password)
  // =========================================================================
  .post(
    '/register',
    async ({ body, request, set }) => {
      const { ipAddress, userAgent } = getIpAndUserAgent(request);
      const expectedHostname = (() => {
        try { return request.headers.get('origin') ? new URL(request.headers.get('origin')!).hostname : undefined; } catch { return undefined; }
      })();
      const result = await register(body, userAgent, ipAddress, expectedHostname, request.headers.get('x-request-id') ?? undefined);
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
  // POST /create-company — Authenticated user creating an additional company
  // =========================================================================
  .post(
    '/create-company',
    async ({ body, request, set }) => {
      const sessionData = await auth.api.getSession({
        headers: request.headers,
      });

      if (!sessionData?.user) {
        set.status = 401;
        throw new UnauthorizedError('Debes haber iniciado sesión para registrar una empresa');
      }

      if (sessionData.user.isActive === false || sessionData.user.emailVerified !== true) {
        throw new UnauthorizedError('La cuenta debe estar activa y tener el correo verificado');
      }

      const { ipAddress } = getIpAndUserAgent(request);
      const expectedHostname = (() => {
        try { return request.headers.get('origin') ? new URL(request.headers.get('origin')!).hostname : undefined; } catch { return undefined; }
      })();
      const result = await onboardTenant(sessionData.user.id, body, ipAddress, expectedHostname, request.headers.get('x-request-id') ?? undefined);
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
    const slug = normalizeTenantSlug(params.slug);
    if (!slug) throw new DomainError('Slug inválido o reservado', 400);
    const [existing] = await adminDb
      .select({ id: companies.id })
      .from(companies)
      .where(eq(companies.slug, slug))
      .limit(1);
    return { available: !existing };
  }, {
    params: t.Object({ slug: t.String() }),
    response: t.Object({ available: t.Boolean() }),
    beforeHandle: checkRateLimit as any,
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
    beforeHandle: checkRateLimit as any,
  })

  // =========================================================================
  // GET /check-email/:email — Email availability check (global scope)
  // =========================================================================
  .get('/check-email/:email', async ({ params }) => {
    const normalized = params.email.trim().toLowerCase();
    const [existing] = await adminDb
      .select({ id: user.id })
      .from(user)
      .where(eq(user.email, normalized))
      .limit(1);
    return { available: !existing };
  }, {
    params: t.Object({ email: t.String() }),
    response: t.Object({ available: t.Boolean() }),
    beforeHandle: checkRateLimit as any,
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
    beforeHandle: checkRateLimit as any,
  })

  // =========================================================================
  // GET /tenant-info — Tenant branding for login page (public, cached)
  // =========================================================================
  .get('/tenant-info', async ({ query, request }) => {
    const host = request.headers.get('host') || '';
    const slug = resolveSlugFromHost(host, env.NODE_ENV === 'production' ? null : query.slug);

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
    const slug = resolveSlugFromHost(host, env.NODE_ENV === 'production' ? null : query.slug);

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
