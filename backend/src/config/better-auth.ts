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

const BASE_DOMAIN = 'zelys.app';

/**
 * Construye la URL canónica del tenant para emails y redirecciones.
 * - Producción:  https://{slug}.zelys.app  |  https://zelys.app
 * - Dev local:   http://{slug}.localhost:5173  |  http://localhost:5173
 * - LAN dev:     http://{ip}:5173 (sin subdominio)
 */
export function resolveTenantUrl(slug?: string | null): string {
    if (env.NODE_ENV === 'production') {
        return slug ? `https://${slug}.${BASE_DOMAIN}` : `https://${BASE_DOMAIN}`;
    }

    // Desarrollo: usa FRONTEND_URL como base
    const frontendUrl = env.FRONTEND_URL.replace(/\/$/, '');
    try {
        const url = new URL(frontendUrl);
        const host = url.hostname;
        const port = url.port ? `:${url.port}` : '';

        // LAN IP — sin subdominio
        if (/^[0-9.]+$/.test(host)) {
            return `${url.protocol}//${host}${port}`;
        }

        // localhost o .localhost
        if (!slug) return `${url.protocol}//${host}${port}`;
        return `${url.protocol}//${slug}.localhost${port}`;
    } catch {
        return slug ? `https://${slug}.${BASE_DOMAIN}` : `https://${BASE_DOMAIN}`;
    }
}

/**
 * Resuelve el slug del tenant y nombre del destinatario para emails.
 * Intenta primero con user.company_id (cache desnormalizado) y hace fallback a member → org → company.
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

        // Fallback: buscar vía member → organization → company
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
 * Resuelve companies.id desde un active organization ID.
 * Cache Redis 5 min para evitar queries repetidas en authGuard.
 */
export async function resolveCompanyIdFromOrg(organizationId: string): Promise<number | null> {
    const cacheKey = `org_to_company:${organizationId}`;
    try {
        const cached = await redis.get(cacheKey);
        if (cached) return Number(cached);
    } catch { /* Cache miss — continuar */ }

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
// 2. PASSWORD — Argon2id via Bun.password (nativo, sin dependencias extra)
// ============================================================================

const argon2PasswordConfig = {
    hash: async (password: string) =>
        Bun.password.hash(password, {
            algorithm: 'argon2id',
            memoryCost: 65536,
            timeCost: 2,
        }),
    verify: async ({ password, hash }: { password: string; hash: string }) => {
        if (!hash || !password) return false;
        try {
            // Argon2 nativo ($argon2...) o formato legacy Better-Auth (hash:salt)
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
// 3. TRUSTED ORIGINS — zelys.app + *.zelys.app en prod; localhost en dev
// ============================================================================

const PRODUCTION_ORIGINS = ['https://zelys.app', 'https://api.zelys.app'];

async function dynamicTrustedOrigins(request?: Request): Promise<string[]> {
    if (!request) return PRODUCTION_ORIGINS;

    const rawOrigin = request.headers.get('origin') || request.headers.get('referer');
    if (!rawOrigin) return PRODUCTION_ORIGINS;

    try {
        const { hostname, origin } = new URL(rawOrigin);

        // Producción: zelys.app y cualquier *.zelys.app
        if (hostname === BASE_DOMAIN || hostname.endsWith(`.${BASE_DOMAIN}`)) {
            return [origin];
        }

        // Desarrollo: localhost, *.localhost, 127.0.0.1 y subredes privadas
        if (env.NODE_ENV !== 'production') {
            if (
                hostname === 'localhost' ||
                hostname.endsWith('.localhost') ||
                hostname === '127.0.0.1' ||
                /^192\.168\.\d+\.\d+$/.test(hostname) ||
                /^10\.\d+\.\d+\.\d+$/.test(hostname) ||
                /^172\.(1[6-9]|2\d|3[01])\.\d+\.\d+$/.test(hostname)
            ) {
                return [origin];
            }
        }
    } catch { /* origen inválido */ }

    return PRODUCTION_ORIGINS;
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
    baseURL: env.BETTER_AUTH_URL,        // https://api.zelys.app
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
            // Throttle: máximo 1 email por minuto por dirección
            const cooldownKey = `email_cooldown:${user.email.toLowerCase()}`;
            try {
                if (await redis.get(cooldownKey)) return;
                await redis.set(cooldownKey, '1', 'EX', 60);
            } catch { /* Redis no disponible — dejar pasar */ }

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
        // argon2PasswordConfig va SOLO en emailAndPassword.password
        generateId: () => uuidv7(),
        crossSubDomainCookies: {
            enabled: Boolean(env.COOKIE_DOMAIN),
            // Better-Auth espera el dominio sin punto inicial
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
