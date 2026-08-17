import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { organization, username, twoFactor } from 'better-auth/plugins';
import { v7 as uuidv7 } from 'uuid';
import { adminDb } from '../core/db';
import * as schema from '@app/schema/tables';
import { emailService } from '../core/email';
import { env } from './env';

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
    secret: process.env.BETTER_AUTH_SECRET || 'zelys-erp-better-auth-secret-key-development-mode-2026',
    baseURL: process.env.BETTER_AUTH_URL || (env.NODE_ENV === 'production' ? 'https://api.zelys.app' : `http://localhost:${env.PORT}`),
    basePath: '/api/auth',
    trustedOrigins: [
        env.FRONTEND_URL,
        'https://*.zelys.app',
        'https://zelys.app',
        'https://dev.zelys.app',
        'https://api.zelys.app',
        'http://localhost:5173',
        'http://localhost:5174',
        'http://localhost:4173',
        'http://127.0.0.1:5173',
        'http://127.0.0.1:5174',
        'http://127.0.0.1:4173',
        'http://192.168.100.50:5173',
        'http://192.168.100.50:4173',
    ].filter(Boolean) as string[],
    password: {
        hash: async (password: string) => {
            return Bun.password.hash(password);
        },
        verify: async ({ password, hash }: { password: string; hash: string }) => {
            return Bun.password.verify(password, hash);
        },
    },
    emailAndPassword: {
        enabled: true,
        autoSignIn: true,
        requireEmailVerification: false,
        sendVerificationEmail: async ({ user, url }) => {
            await emailService.sendVerificationEmail(user.email, url, user.name);
        },
        sendResetPassword: async ({ user, url }) => {
            await emailService.sendPasswordResetEmail(user.email, url, user.name);
        },
    },
    user: {
        additionalFields: {
            companyId: {
                type: 'number',
                required: false,
                fieldName: 'company_id',
            },
            entityId: {
                type: 'number',
                required: false,
                fieldName: 'entity_id',
            },
            isActive: {
                type: 'boolean',
                required: false,
                defaultValue: true,
                fieldName: 'is_active',
            },
            isOwner: {
                type: 'boolean',
                required: false,
                defaultValue: false,
                fieldName: 'is_owner',
            },
            lastLogin: {
                type: 'date',
                required: false,
                fieldName: 'last_login',
            },
        },
    },
    advanced: {
        generateId: () => uuidv7(),
        crossSubDomainCookies: {
            enabled: true,
            domain: env.NODE_ENV === 'production' ? (env.COOKIE_DOMAIN || '.zelys.app') : undefined,
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
