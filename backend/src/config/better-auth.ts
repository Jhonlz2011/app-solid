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

export function resolveTenantUrl(slug?: string | null): string {
    if (!slug) return env.FRONTEND_URL;

    try {
        const url = new URL(env.FRONTEND_URL);
        const host = url.hostname;

        // If localhost or 127.0.0.1
        if (host === 'localhost' || host === '127.0.0.1') {
            return `${url.protocol}//${slug}.localhost${url.port ? `:${url.port}` : ''}`;
        }

        // If local naked LAN IP address (e.g. 192.168.100.50), keep the IP without subdomains
        if (/^[0-9.]+$/.test(host)) {
            return `${url.protocol}//${host}${url.port ? `:${url.port}` : ''}`;
        }

        // If domain is or ends with zelys.app (production, staging)
        const domainParts = host.split('.');
        const baseDomain = host.includes('zelys.app') ? 'zelys.app' : domainParts.slice(-2).join('.');
        return `${url.protocol}//${slug}.${baseDomain}${url.port ? `:${url.port}` : ''}`;
    } catch {
        return `https://${slug}.zelys.app`;
    }
}

export async function getTenantInfoForEmail(email: string) {
    try {
        const [userWithCompany] = await adminDb
            .select({
                name: schema.user.name,
                companySlug: schema.companies.slug,
            })
            .from(schema.user)
            .leftJoin(schema.companies, eq(schema.user.company_id, schema.companies.id))
            .where(eq(schema.user.email, email.toLowerCase()))
            .limit(1);

        return {
            tenantSlug: userWithCompany?.companySlug || null,
            recipientName: userWithCompany?.name || email.split('@')[0],
        };
    } catch (err) {
        console.error('[BetterAuth] Error resolving tenant info for email:', err);
        return { tenantSlug: null, recipientName: email.split('@')[0] };
    }
}

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
            // Bun native Argon2 / Bcrypt verification (starts with $)
            if (hash.startsWith('$')) {
                return await Bun.password.verify(password, hash);
            }
            // Safe fallback for legacy Better-Auth scrypt format (salt:key)
            if (hash.includes(':')) {
                const { verifyPassword } = await import('better-auth/crypto').catch(() => ({ verifyPassword: null }));
                if (verifyPassword) {
                    return await verifyPassword({ hash, password });
                }
            }
            return await Bun.password.verify(password, hash);
        } catch (err) {
            console.error('[BetterAuth Password Verifier] Error verifying password:', err);
            return false;
        }
    },
};

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
    trustedOrigins: [
        env.FRONTEND_URL,
        'https://*.zelys.app',
        'https://zelys.app',
        'https://dev.zelys.app',
        'https://api.zelys.app',
        'http://*.localhost:5173',
        'http://*.localhost:4173',
        'http://localhost:5173',
        'http://localhost:4173',
        'http://192.168.100.50:5173',
        'http://192.168.100.50:4173',
    ].filter(Boolean) as string[],
    databaseHooks: {
        user: {
            update: {
                after: async (user) => {
                    // Si el correo pasa a verificado, notificar en tiempo real vía SSE a todas las sesiones del usuario
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
            // Protección contra abuso de reenvíos: Redis TTL 60s
            const cooldownKey = `email_cooldown:${user.email.toLowerCase()}`;
            try {
                const isThrottled = await redis.get(cooldownKey);
                if (isThrottled) {
                    console.warn(`[BetterAuth] Verification email throttled for ${user.email}`);
                    return;
                }
                await redis.set(cooldownKey, '1', 'EX', 60);
            } catch (err) {
                console.warn('[BetterAuth] Redis cooldown check error, proceeding:', err);
            }

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
            isOwner: {
                type: 'boolean',
                required: false,
                defaultValue: false,
                fieldName: 'is_owner',
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
