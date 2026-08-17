import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { organization, username, twoFactor, passkey } from 'better-auth/plugins';
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
            passkey: schema.passkey,
        },
    }),
    secret: process.env.BETTER_AUTH_SECRET || 'zelys-erp-better-auth-secret-key-development-mode-2026',
    baseURL: env.FRONTEND_URL,
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
        generateId: false,
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
        passkey(),
    ],
});

export type Auth = typeof auth;
