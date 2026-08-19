import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { organization, username, twoFactor } from 'better-auth/plugins';
import { v7 as uuidv7 } from 'uuid';
import { adminDb } from '../core/db';
import { redis } from '../core/cache/redis';
import { broadcast } from '../core/sse';
import { RealtimeEvents } from '@app/schema/realtime-events';
import { eq } from '@app/schema';
import * as schema from '@app/schema/tables';
import { emailService } from '../core/email';
import { env } from './env';

// ============================================================================
// 1. TENANT URL RESOLVER
// ============================================================================

/**
 * Builds the canonical tenant URL for user-facing emails and redirects.
 * - Production: https://{slug}.zelys.app or https://zelys.app
 * - Local dev:   http://{slug}.localhost:5173 or http://localhost:5173
 * - LAN dev:     http://192.168.x.x:5173
 */
export function resolveTenantUrl(slug?: string | null): string {
    const frontendUrl = env.FRONTEND_URL.replace(/\/$/, '');

    try {
        const url = new URL(frontendUrl);
        const host = url.hostname;

        // Strip 'api.' prefix if FRONTEND_URL in backend env points to the API subdomain
        const cleanHost = host.startsWith('api.') ? host.replace(/^api\./, '') : host;
        const port = url.port ? `:${url.port}` : '';

        if (!slug) {
            return `${url.protocol}//${cleanHost}${port}`;
        }

        // Localhost / 127.0.0.1
        if (cleanHost === 'localhost' || cleanHost === '127.0.0.1') {
            return `${url.protocol}//${slug}.localhost${port}`;
        }

        // LAN IP (e.g. 192.168.100.50) — keep naked IP
        if (/^[0-9.]+$/.test(cleanHost)) {
            return `${url.protocol}//${cleanHost}${port}`;
        }

        // Production / Staging domain (zelys.app)
        const parts = cleanHost.split('.');
        const rootDomain = parts.slice(-2).join('.');
        return `${url.protocol}//${slug}.${rootDomain}${port}`;
    } catch {
        return slug ? `https://${slug}.zelys.app` : 'https://zelys.app';
    }
}

/**
 * Resolves the tenant slug and recipient display name for email notifications.
 */
export async function getTenantInfoForEmail(email: string) {
    try {
        const [row] = await adminDb
            .select({
                name: schema.user.name,
                companySlug: schema.companies.slug,
            })
            .from(schema.user)
            .leftJoin(schema.companies, eq(schema.user.company_id, schema.companies.id))
            .where(eq(schema.user.email, email.toLowerCase()))
            .limit(1);

        if (row?.companySlug) {
            return {
                tenantSlug: row.companySlug,
                recipientName: row.name || email.split('@')[0],
            };
        }

        const [orgRow] = await adminDb
            .select({
                name: schema.user.name,
                companySlug: schema.companies.slug,
            })
            .from(schema.user)
            .innerJoin(schema.member, eq(schema.member.userId, schema.user.id))
            .innerJoin(schema.organization, eq(schema.organization.id, schema.member.organizationId))
            .innerJoin(schema.companies, eq(schema.companies.organization_id, schema.organization.id))
            .where(eq(schema.user.email, email.toLowerCase()))
            .limit(1);

        return {
            tenantSlug: orgRow?.companySlug || null,
            recipientName: orgRow?.name || row?.name || email.split('@')[0],
        };
    } catch (err) {
        console.error('[BetterAuth] Error resolving tenant info for email:', err);
        return { tenantSlug: null, recipientName: email.split('@')[0] };
    }
}

/**
 * Resolves companies.id from an active organization ID.
 * Cached in Redis (5min TTL) to avoid repeated queries in authGuard.
 */
export async function resolveCompanyIdFromOrg(organizationId: string): Promise<number | null> {
    const cacheKey = `org_to_company:${organizationId}`;
    try {
        const cached = await redis.get(cacheKey);
        if (cached) return Number(cached);
    } catch { /* Cache miss */ }

    const [company] = await adminDb
        .select({ id: schema.companies.id })
        .from(schema.companies)
        .where(eq(schema.companies.organization_id, organizationId))
        .limit(1);

    if (company) {
        redis.set(cacheKey, String(company.id), 'EX', 300).catch(() => {});
        return company.id;
    }
    return null;
}

// ============================================================================
// 2. PASSWORD VERIFIER
// ============================================================================

const argon2PasswordConfig = {
    hash: async (password: string) => {
        return Bun.password.hash(password, {
            algorithm: 'argon2id',
            memoryCost: 65536,
            timeCost: 2,
        });
    },
    verify: async ({ password, hash }: { password: string; hash: string }) => {
        if (!hash || !password) return false;
        try {
            if (hash.startsWith('$')) {
                return await Bun.password.verify(password, hash);
            }
            if (hash.includes(':')) {
                const { verifyPassword } = await import('better-auth/crypto').catch(() => ({ verifyPassword: null }));
                if (verifyPassword) return await verifyPassword({ hash, password });
            }
            return await Bun.password.verify(password, hash);
        } catch {
            return false;
        }
    },
};

// ============================================================================
// 3. DYNAMIC TRUSTED ORIGINS VALIDATOR
// ============================================================================

/**
 * Dynamically validates incoming requests against allowed origins.
 * - In Production: allows zelys.app and all *.zelys.app subdomains.
 * - In Development: allows any localhost, 127.0.0.1, or local LAN IP (192.168.x.x, 10.x.x.x, 172.x.x.x).
 */
async function dynamicTrustedOrigins(request?: Request): Promise<string[]> {
    const defaults = ['https://zelys.app', 'https://api.zelys.app', env.FRONTEND_URL].filter(Boolean);

    if (!request) {
        return defaults;
    }

    const rawOrigin = request.headers.get('origin') || request.headers.get('referer');
    if (!rawOrigin) {
        return defaults;
    }

    try {
        const originUrl = new URL(rawOrigin);
        const host = originUrl.hostname;
        const normalizedOrigin = originUrl.origin;

        // 1. Production / Staging: exact match on zelys.app or *.zelys.app
        if (host === 'zelys.app' || host.endsWith('.zelys.app')) {
            return [normalizedOrigin];
        }

        // 2. Development: allow localhost, .localhost, 127.0.0.1, and private LAN subnets
        if (env.NODE_ENV !== 'production') {
            if (
                host === 'localhost' ||
                host.endsWith('.localhost') ||
                host === '127.0.0.1' ||
                /^192\.168\.\d+\.\d+$/.test(host) ||
                /^10\.\d+\.\d+\.\d+$/.test(host) ||
                /^172\.(1[6-9]|2\d|3[01])\.\d+\.\d+$/.test(host)
            ) {
                return [normalizedOrigin];
            }
        }

        // 3. Explicit configured FRONTEND_URL match
        if (env.FRONTEND_URL) {
            const configuredOrigin = new URL(env.FRONTEND_URL).origin;
            if (normalizedOrigin === configuredOrigin) {
                return [normalizedOrigin];
            }
        }
    } catch {
        // Invalid origin format
    }

    return defaults;
}

// ============================================================================
// 4. BETTER AUTH INSTANCE
// ============================================================================

export const auth = betterAuth({
    database: drizzleAdapter(adminDb, {
        provider: 'pg',
        schema: {
            user: schema.user,
            session: schema.session,
            account: schema.account,
            verification: schema.verification,
            organization: schema.organization,
            member: schema.member,
            invitation: schema.invitation,
            twoFactor: schema.twoFactor,
        },
    }),
    secret: env.BETTER_AUTH_SECRET,
    baseURL: env.BETTER_AUTH_URL,
    basePath: '/api/auth',
    trustedOrigins: dynamicTrustedOrigins,
    databaseHooks: {
        user: {
            update: {
                after: async (user) => {
                    if (user.emailVerified) {
                        broadcast(
                            RealtimeEvents.USER.EMAIL_VERIFIED,
                            { userId: user.id },
                            `user:${user.id}`
                        );
                    }
                },
            },
        },
    },
    emailAndPassword: {
        enabled: true,
        autoSignIn: true,
        requireEmailVerification: false,
        password: argon2PasswordConfig,
        sendResetPassword: async ({ user, url, token }) => {
            const { tenantSlug, recipientName } = await getTenantInfoForEmail(user.email);
            const baseUrl = resolveTenantUrl(tenantSlug);
            const resetUrl = `${baseUrl}/reset-password?token=${token}&url=${encodeURIComponent(url)}`;
            await emailService.sendPasswordResetEmail(user.email, resetUrl, recipientName);
        },
    },
    emailVerification: {
        sendOnSignUp: false,
        autoSignInAfterVerification: true,
        sendVerificationEmail: async ({ user, token }) => {
            const cooldownKey = `email_cooldown:${user.email.toLowerCase()}`;
            try {
                const isThrottled = await redis.get(cooldownKey);
                if (isThrottled) return;
                await redis.set(cooldownKey, '1', 'EX', 60);
            } catch { /* Redis cooldown pass-through */ }

            const { tenantSlug, recipientName } = await getTenantInfoForEmail(user.email);
            const baseUrl = resolveTenantUrl(tenantSlug);
            const verificationUrl = `${baseUrl}/verify-email?token=${token}`;
            await emailService.sendVerificationEmail(user.email, verificationUrl, recipientName);
        },
    },
    user: {
        additionalFields: {
            companyId: {
                type: 'number',
                required: false,
                fieldName: 'company_id',
                input: false,
            },
            entityId: {
                type: 'number',
                required: false,
                fieldName: 'entity_id',
                input: false,
            },
            isActive: {
                type: 'boolean',
                required: false,
                defaultValue: true,
                fieldName: 'is_active',
                input: false,
            },
        },
    },
    advanced: {
        password: argon2PasswordConfig,
        generateId: () => uuidv7(),
        crossSubDomainCookies: {
            enabled: Boolean(env.COOKIE_DOMAIN),
            domain: env.COOKIE_DOMAIN ? env.COOKIE_DOMAIN.replace(/^\./, '') : undefined,
        },
        defaultCookieAttributes: {
            secure: env.NODE_ENV === 'production',
            sameSite: 'lax',
            httpOnly: true,
        },
    },
    plugins: [
        username({
            minUsernameLength: 3,
            maxUsernameLength: 30,
        }),
        organization({
            allowUserToCreateOrganization: true,
        }),
        twoFactor(),
    ],
});

export type Auth = typeof auth;
