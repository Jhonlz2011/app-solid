import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { organization, username, twoFactor } from 'better-auth/plugins';
import { v7 as uuidv7 } from 'uuid';
import { adminDb } from '../core/db';
import * as schema from '@app/schema/tables';
import { emailService } from '../core/email';
import { env } from './env';

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
        'http://192.168.100.50:5173',
        'http://192.168.100.50:4173',
    ].filter(Boolean) as string[],
    emailAndPassword: {
        enabled: true,
        autoSignIn: true,
        requireEmailVerification: false,
        password: argon2PasswordConfig,
        sendResetPassword: async ({ user, url }) => {
            await emailService.sendPasswordResetEmail(user.email, url, user.name);
        },
    },
    emailVerification: {
        sendOnSignUp: false,
        autoSignInAfterVerification: true,
        sendVerificationEmail: async ({ user, url, token }) => {
            const verificationUrl = `${env.FRONTEND_URL}/verify-email?token=${token}`;
            await emailService.sendVerificationEmail(user.email, verificationUrl, user.name);
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
