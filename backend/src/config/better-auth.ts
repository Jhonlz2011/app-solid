import { betterAuth } from 'better-auth';
import { APIError, createAuthMiddleware, isAPIError } from 'better-auth/api';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { organization, username, twoFactor } from 'better-auth/plugins';
import { v7 as uuidv7 } from 'uuid';
import { adminDb } from '../core/db';
import { redis } from '../core/cache/redis';
import { broadcastToUser } from '../core/sse';
import { RealtimeEvents } from '@app/schema/realtime-events';
import { eq, and, gt, asc, inArray, sql } from '@app/schema';
import * as schema from '@app/schema/tables';
import { emailService } from '../core/email';
import { env } from './env';
import { hashPassword, verifyPassword } from '../core/security';
import { DomainError } from '../core/errors';
import { extractIpFromHeaders } from '../plugins/ip';
import { buildTenantUrl } from '@app/schema/utils';
import { markMfaStepUp } from '../plugins/mfa-step-up';

// ============================================================================
// 1. TENANT URL RESOLVER
// ============================================================================

const BASE_DOMAIN = 'zelys.app';

/**
 * Construye la URL canónica del tenant para emails y redirecciones en producción (*.zelys.app).
 * Delega a la función canónica compartida buildTenantUrl.
 */
export function resolveTenantUrl(slug?: string | null): string {
    return buildTenantUrl(slug ?? '', '');
}

/**
 * Resuelve el slug del tenant y nombre del destinatario para emails desde membresías activas.
 */
export async function getTenantInfoForEmail(email: string) {
    try {
        const [orgRow] = await adminDb
            .select({
                name: schema.user.name,
                companySlug: schema.companies.slug,
            })
            .from(schema.user)
            .innerJoin(schema.member, eq(schema.member.userId, schema.user.id))
            .innerJoin(schema.organization, eq(schema.organization.id, schema.member.organizationId))
            .innerJoin(schema.companies, eq(schema.companies.organization_id, schema.organization.id))
            .where(and(
                eq(schema.user.email, email.toLowerCase()),
                eq(schema.member.status, 'ACTIVE'),
            ))
            .limit(1);

        return {
            tenantSlug: orgRow?.companySlug || null,
            recipientName: orgRow?.name || email.split('@')[0],
        };
    } catch (err) {
        console.error('[BetterAuth] Error resolving tenant info for email:', err);
        return { tenantSlug: null, recipientName: email.split('@')[0] };
    }
}

/**
 * Resuelve companies.id desde un active organization ID.
 * Cache Redis 1h — la relación org→company es inmutable.
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
        .where(and(
            eq(schema.companies.organization_id, organizationId),
            eq(schema.companies.is_active, true),
        ))
        .limit(1);

    if (company) {
        redis.set(cacheKey, String(company.id), 'EX', 3600).catch(() => {});
        return company.id;
    }
    return null;
}


// ============================================================================
// 2. PASSWORD — Argon2id via centralized password service
// ============================================================================

const argon2PasswordConfig = {
    hash: (password: string) => hashPassword(password),
    verify: ({ password, hash }: { password: string; hash: string }) => verifyPassword(password, hash),
};

// ============================================================================
// 3. TRUSTED ORIGINS — zelys.app + *.zelys.app en prod; localhost en dev
// ============================================================================

const PRODUCTION_ORIGINS = [
    'https://zelys.app',
    'https://api.zelys.app',
    'https://in.zelys.app',
    'https://*.zelys.app',
];

/**
 * Validates whether a hostname belongs to an allowed origin.
 * Shared logic for CORS (Elysia) and trustedOrigins (Better Auth).
 */
export function isAllowedOrigin(hostname: string): boolean {
    const normalized = hostname.trim().toLowerCase();
    // Producción: zelys.app y cualquier subdominio *.zelys.app
    if (normalized === BASE_DOMAIN || normalized.endsWith(`.${BASE_DOMAIN}`)) return true;

    // Desarrollo: localhost, *.localhost, 127.0.0.1 y subredes privadas
    if (env.NODE_ENV !== 'production') {
        if (
            normalized === 'localhost' ||
            normalized.endsWith('.localhost') ||
            normalized === '127.0.0.1' ||
            /^192\.168\.\d+\.\d+$/.test(normalized) ||
            /^10\.\d+\.\d+\.\d+$/.test(normalized) ||
            /^172\.(1[6-9]|2\d|3[01])\.\d+\.\d+$/.test(normalized)
        ) {
            return true;
        }
    }

    return false;
}

/**
 * Validates a full Origin/Referer URL enforcing HTTPS in production.
 */
export function isAllowedOriginUrl(rawOrigin: string): boolean {
    try {
        const parsed = new URL(rawOrigin);
        if (env.NODE_ENV === 'production' && parsed.protocol !== 'https:') {
            return false;
        }
        if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
            return false;
        }
        return isAllowedOrigin(parsed.hostname);
    } catch {
        return false;
    }
}

async function dynamicTrustedOrigins(request?: Request): Promise<string[]> {
    const baseOrigins = env.NODE_ENV === 'production'
        ? PRODUCTION_ORIGINS
        : [...PRODUCTION_ORIGINS, env.FRONTEND_URL.replace(/\/$/, '')];

    if (!request) return baseOrigins;

    const rawOrigin = request.headers.get('origin') || request.headers.get('referer');
    if (!rawOrigin) return baseOrigins;

    if (isAllowedOriginUrl(rawOrigin)) {
        const { origin } = new URL(rawOrigin);
        return [...new Set([...baseOrigins, origin])];
    }

    return baseOrigins;
}

// ============================================================================
// 4. HELPERS
// ============================================================================

/**
 * Generate a unique username from an email or display name.
 * Used by OAuth providers (Google, Microsoft) and databaseHooks fallback.
 * Format: {base_slug}_{random4} — max 29 chars, always lowercase.
 */
function generateUsername(email?: string | null, name?: string | null): string {
    const rawBase = email
        ? email.split('@')[0].replace(/[^a-zA-Z0-9_-]/g, '').toLowerCase()
        : (name ? name.replace(/[^a-zA-Z0-9_-]/g, '').toLowerCase() : 'user');
    const base = rawBase.length >= 3 ? rawBase : `${rawBase}usr`;
    const randomSuffix = Math.random().toString(36).substring(2, 6);
    return `${base.slice(0, 24)}_${randomSuffix}`;
}

/**
 * Limita a un máximo de 5 sesiones concurrentes activas por usuario.
 * Revoca automáticamente las sesiones más antiguas, purga sus tokens de Redis y notifica vía SSE.
 */
export async function enforceMaxActiveSessions(userId: string, maxSessions = 5): Promise<void> {
    try {
        const userSessions = await adminDb
            .select({
                id: schema.session.id,
                token: schema.session.token,
                createdAt: schema.session.createdAt,
            })
            .from(schema.session)
            .where(
                and(
                    eq(schema.session.userId, userId),
                    sql`${schema.session.expiresAt} > NOW()`
                )
            )
            .orderBy(asc(schema.session.createdAt));

        if (userSessions.length > maxSessions) {
            const excessCount = userSessions.length - maxSessions;
            const toRevoke = userSessions.slice(0, excessCount);
            const revokeIds = toRevoke.map(s => s.id);

            // 1. Eliminar de Postgres
            await adminDb
                .delete(schema.session)
                .where(inArray(schema.session.id, revokeIds));

            // 2. Invalidar caché en Redis y emitir SSE para cada sesión revocada
            const revokedTokens = new Set(toRevoke.map(s => s.token));
            await Promise.all(
                toRevoke.map(async (s) => {
                    try {
                        await Promise.all([
                            redis.del(s.token),
                            redis.del(`session:${s.token}`),
                            redis.del(`better-auth:session:${s.token}`),
                            redis.del(`session:${s.id}`),
                        ]);
                    } catch { /* Redis best effort */ }

                    broadcastToUser(userId, RealtimeEvents.USER.SESSION_REVOKED, {
                        id: userId,
                        sessionId: s.id,
                        reason: 'MAX_SESSIONS_EXCEEDED',
                    });
                })
            );

            // Prune revoked tokens from Better Auth secondaryStorage active-sessions index
            try {
                const activeListKey = `active-sessions-${userId}`;
                const listRaw = await redis.get(activeListKey);
                if (listRaw) {
                    const parsed = JSON.parse(listRaw) as Array<{ token: string; expiresAt: number }>;
                    const remaining = parsed.filter(entry => !revokedTokens.has(entry.token));
                    if (remaining.length > 0) {
                        const ttl = await redis.ttl(activeListKey);
                        if (ttl > 0) {
                            await redis.set(activeListKey, JSON.stringify(remaining), 'EX', ttl);
                        } else {
                            await redis.set(activeListKey, JSON.stringify(remaining));
                        }
                    } else {
                        await redis.del(activeListKey);
                    }
                }
            } catch { /* Redis best effort */ }

            console.info(`[BetterAuth] Límite de ${maxSessions} sesiones aplicado para usuario ${userId}: revocada(s) ${excessCount} sesión(es) antigua(s).`);
        }
    } catch (err) {
        console.error('[BetterAuth] Error aplicando límite de sesiones activas:', err);
    }
}

async function revokeAllSessionsForGlobalUser(userId: string): Promise<void> {
    const rows = await adminDb
        .select({ id: schema.session.id, token: schema.session.token })
        .from(schema.session)
        .where(eq(schema.session.userId, userId));

    if (rows.length > 0) {
        await adminDb.delete(schema.session).where(eq(schema.session.userId, userId));
        const keysToDelete = [
            `active-sessions-${userId}`,
            ...rows.flatMap(row => [
                row.token,
                `session:${row.token}`,
                `better-auth:session:${row.token}`,
                `session:${row.id}`,
            ]),
        ];
        await redis.del(...keysToDelete);
        broadcastToUser(userId, RealtimeEvents.USER.SESSION_REVOKED, { userId, reason: 'GLOBAL_ACCOUNT_DISABLED' });
    } else {
        await redis.del(`active-sessions-${userId}`).catch(() => {});
    }
}

// ============================================================================
// 5. BETTER AUTH INSTANCE
// ============================================================================

const GET_AND_DELETE_SCRIPT = `
local v = redis.call('GET', KEYS[1])
if v then redis.call('DEL', KEYS[1]) end
return v
`;

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
    session: {
        storeSessionInDatabase: true,
        expiresIn: 60 * 60 * 24 * 7, // 7 días
        updateAge: 60 * 60 * 24, // 1 día
    },
    secondaryStorage: {
        get: async (key: string) => {
            return await redis.get(key);
        },
        set: async (key: string, value: string, ttl?: number) => {
            if (ttl) {
                await redis.set(key, value, 'EX', ttl);
            } else {
                await redis.set(key, value);
            }
        },
        delete: async (key: string) => {
            await redis.del(key);
        },
        getAndDelete: async (key: string) => {
            const value = await redis.eval(GET_AND_DELETE_SCRIPT, 1, key);
            return typeof value === 'string' ? value : null;
        },
        increment: async (key: string, ttl?: number) => {
            const count = await redis.incr(key);
            if (count === 1 && ttl) {
                await redis.expire(key, ttl);
            }
            return count;
        },
    },
    rateLimit: {
        enabled: true,
        window: 60,
        max: 100,
        storage: 'secondary-storage',
    },
    onAPIError: {
        errorURL: `${(env.NODE_ENV === 'production' ? 'https://in.zelys.app' : env.FRONTEND_URL).replace(/\/$/, '')}/login`,
        onError: (error) => {
            console.error('[BetterAuth] API Error:', error);
        },
    },
    socialProviders: {
        ...(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET ? {
            google: {
                clientId: env.GOOGLE_CLIENT_ID,
                clientSecret: env.GOOGLE_CLIENT_SECRET,
                accessType: 'offline',
                prompt: 'select_account',
                disableImplicitSignUp: true,
                mapProfileToUser: (profile) => {
                    const username = generateUsername(profile.email, profile.name);
                    return {
                        name: profile.name || username,
                        email: profile.email,
                        image: profile.picture || undefined,
                        username,
                        displayUsername: profile.name || username,
                    emailVerified: profile.email_verified === true,
                    };
                },
            },
        } : {}),
        ...(env.MICROSOFT_CLIENT_ID && env.MICROSOFT_CLIENT_SECRET ? {
            microsoft: {
                clientId: env.MICROSOFT_CLIENT_ID,
                clientSecret: env.MICROSOFT_CLIENT_SECRET,
                tenantId: env.MICROSOFT_TENANT_ID || 'common',
                disableImplicitSignUp: true,
                mapProfileToUser: (profile) => {
                    const rawEmail = profile.email || (profile as any).userPrincipalName || (profile as any).mail || '';
                    const rawName = profile.name || (profile as any).displayName || '';
                    if (!rawEmail) {
                        throw new Error('Microsoft OAuth profile did not include a usable email address');
                    }
                    const username = generateUsername(rawEmail, rawName);
                    const hasExplicitTenant = Boolean(env.MICROSOFT_TENANT_ID && env.MICROSOFT_TENANT_ID !== 'common');
                    const emailVerified = (profile as any).email_verified === true
                        || (hasExplicitTenant && (profile as any).email_verified !== false && Boolean(rawEmail));
                    return {
                        name: rawName || username,
                        email: rawEmail,
                        image: (profile as any).picture || undefined,
                        username,
                        displayUsername: rawName || username,
                        emailVerified,
                    };
                },
            },
        } : {}),
    },
    account: {
        accountLinking: {
            // Explicit linkSocial() while authenticated is permitted;
            // implicit linking on OAuth sign-in is strictly disabled.
            enabled: true,
            disableImplicitLinking: true,
            requireLocalEmailVerified: true,
            trustedProviders: [],
        },
    },
    hooks: {
        before: createAuthMiddleware(async (ctx) => {
            if (ctx.path === '/sign-in/email' || ctx.path === '/sign-in/username') {
                const headers = ctx.headers || ctx.request?.headers;
                const extracted = headers ? extractIpFromHeaders(headers) : null;
                const turnstileToken = headers?.get('x-turnstile-token');
                const expectedHostname = (() => {
                    try {
                        const origin = headers?.get('origin');
                        return origin ? new URL(origin).hostname : undefined;
                    } catch {
                        return undefined;
                    }
                })();

                const { verifyTurnstileToken } = await import('../core/security/turnstile.service');
                try {
                    await verifyTurnstileToken(turnstileToken, {
                        action: 'login',
                        ipAddress: extracted?.ipAddress ?? undefined,
                        requestId: headers?.get('x-request-id') ?? undefined,
                        expectedHostname,
                    });
                } catch (err) {
                    if (err instanceof DomainError) {
                        const status = err.status === 503
                            ? 'SERVICE_UNAVAILABLE'
                            : err.status === 403
                                ? 'FORBIDDEN'
                                : 'BAD_REQUEST';
                        throw new APIError(status, {
                            message: err.message,
                            code: 'TURNSTILE_VERIFICATION_FAILED',
                        });
                    }
                    throw err;
                }
            }
        }),
        after: createAuthMiddleware(async (ctx) => {
            if (ctx.path === '/two-factor/verify-totp' || ctx.path === '/two-factor/verify-backup-code') {
                const returned = ctx.context.returned;
                if (returned instanceof Error || isAPIError(returned)) {
                    return;
                }
                let verifiedSessionId = ctx.context.newSession?.session?.id ?? ctx.context.session?.session?.id;
                if (!verifiedSessionId && returned && typeof returned === 'object' && 'token' in returned && typeof (returned as { token?: unknown }).token === 'string') {
                    const token = (returned as { token: string }).token;
                    const [sessionRow] = await adminDb
                        .select({ id: schema.session.id })
                        .from(schema.session)
                        .where(eq(schema.session.token, token))
                        .limit(1);
                    verifiedSessionId = sessionRow?.id;
                }
                if (verifiedSessionId) {
                    await markMfaStepUp(verifiedSessionId);
                }
            }
        }),
    },
    databaseHooks: {
        user: {
            create: {
                before: async (user) => {
                    const existingUsername = (user as any).username;
                    const username = existingUsername?.trim()
                        ? existingUsername
                        : generateUsername(user.email, user.name);

                    return {
                        data: {
                            ...user,
                            id: (user as any).id || uuidv7(),
                            username,
                            displayUsername: (user as any).displayUsername || user.name || username,
                            emailVerified: (user as any).emailVerified === true,
                        },
                    };
                },
            },
            update: {
                after: async (user) => {
                    const securityUser = user as typeof user & { isActive?: boolean; is_active?: boolean };
                    if (securityUser.isActive === false || securityUser.is_active === false) {
                        await revokeAllSessionsForGlobalUser(user.id);
                    }
                    // Emitir actualización de perfil en tiempo real para todos los dispositivos del usuario vía SSE
                    broadcastToUser(
                        user.id,
                        RealtimeEvents.USER.PROFILE_UPDATED,
                        {
                            id: user.id,
                            username: (user as any).username,
                            name: (user as any).name,
                            email: (user as any).email,
                        }
                    );

                    if (user.emailVerified) {
                        broadcastToUser(
                            user.id,
                            RealtimeEvents.USER.EMAIL_VERIFIED,
                            { userId: user.id }
                        );
                    }
                },
            },
        },
        account: {
            create: {
                before: async (acc) => {
                    return {
                        data: {
                            ...acc,
                            id: (acc as any).id || uuidv7(),
                        },
                    };
                },
            },
        },
        session: {
            create: {
                before: async (sess, context) => {
                    const headers = ((context as any)?.headers || (context as any)?.request?.headers) as Headers | undefined;
                    const extracted = headers ? extractIpFromHeaders(headers) : null;

                    return {
                        data: {
                            ...sess,
                            id: (sess as any).id || uuidv7(),
                            ipAddress: sess.ipAddress || extracted?.ipAddress || (env.NODE_ENV !== 'production' ? '127.0.0.1' : undefined),
                            userAgent: sess.userAgent || extracted?.userAgent || 'Desconocido',
                        },
                    };
                },
                after: async (sess) => {
                    if (sess.userId) {
                        try {
                            await adminDb
                                .update(schema.user)
                                .set({ last_login: new Date() })
                                .where(eq(schema.user.id, sess.userId));
                        } catch (err) {
                            console.error('[BetterAuth] Error actualizando last_login en session.create:', err);
                        }

                        // Límite de 5 sesiones activas concurrentes
                        await enforceMaxActiveSessions(sess.userId, 5);

                        // Notificar vía SSE a los clientes del usuario
                        broadcastToUser(sess.userId, RealtimeEvents.USER.SESSION_CREATED, {
                            id: sess.userId,
                            sessionId: sess.id,
                        });
                    }
                },
            },
        },
    },
    emailAndPassword: {
        enabled: true,
        autoSignIn: false,
        requireEmailVerification: true,
        revokeSessionsOnPasswordReset: true,
        password: argon2PasswordConfig,
        sendResetPassword: async ({ user, url, token }) => {
            const { tenantSlug, recipientName } = await getTenantInfoForEmail(user.email);
            const baseUrl = resolveTenantUrl(tenantSlug);
            const resetUrl = `${baseUrl}/reset-password?token=${token}&url=${encodeURIComponent(url)}`;
            await emailService.sendPasswordResetEmail(user.email, resetUrl, recipientName);
        },
    },
    emailVerification: {
        sendOnSignUp: true,
        autoSignInAfterVerification: true,
        sendVerificationEmail: async ({ user, token }) => {
            // Throttle: máximo 1 email por minuto por dirección
            const cooldownKey = `email_cooldown:${user.email.toLowerCase()}`;
            let cooldownClaimed = false;
            try {
                const result = await redis.set(cooldownKey, '1', 'EX', 60, 'NX');
                if (result !== 'OK') return;
                cooldownClaimed = true;
            } catch { /* Redis no disponible — intentar el envío; Better Auth conserva rate limits */ }

            try {
                const { tenantSlug, recipientName } = await getTenantInfoForEmail(user.email);
                const baseUrl = resolveTenantUrl(tenantSlug);
                const verificationUrl = `${baseUrl}/verify-email?token=${token}`;
                await emailService.sendVerificationEmail(user.email, verificationUrl, recipientName);
            } catch (error) {
                if (cooldownClaimed) await redis.del(cooldownKey).catch(() => {});
                throw error;
            }
        },
    },
    user: {
        changeEmail: {
            enabled: true,
        },
        additionalFields: {
            companyId: {
                type: 'number',
                required: false,
                fieldName: 'company_id',
                input: false,
            },
            isActive: {
                type: 'boolean',
                required: false,
                defaultValue: true,
                fieldName: 'is_active',
                input: false,
            },
            lastLogin: {
                type: 'date',
                required: false,
                fieldName: 'last_login',
                input: false,
            },
        },
    },
    advanced: {
        ipAddress: {
            ipAddressHeaders: ['cf-connecting-ip', 'x-real-ip'],
        },
        database: {
            generateId: () => uuidv7(),
        },
        // Session cookies remain host-only. Tenant switches use an authenticated handoff.
        crossSubDomainCookies: {
            enabled: false,
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
            allowUserToCreateOrganization: false,
        }),
        twoFactor(),
    ],
});

export type Auth = typeof auth;
