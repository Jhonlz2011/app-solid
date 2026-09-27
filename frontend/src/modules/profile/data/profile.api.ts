/**
 * profile.api.ts — Eden API fetchers for Profile & Session module
 *
 * Strictly fetchers — no hooks, no casts, no error mapping.
 * All return types inferred from backend response schemas.
 */
import { api } from '@shared/lib/eden';
import { authClient } from '@shared/lib/auth-client';
import { throwApiError } from '@shared/utils/api-errors';

export const profileApi = {
    getMe: async () => {
        const { data, error } = await api.profile.me.get();
        if (error) throwApiError(error);
        return data!;
    },

    updateProfile: async (body: { username?: string; name?: string }) => {
        const { data, error } = await api.profile.put(body);
        if (error) throwApiError(error);
        return data!;
    },

    changeEmail: async (newEmail: string) => {
        const res = await authClient.changeEmail({
            newEmail,
            callbackURL: '/verify-email',
        });
        if (res.error) {
            throw new Error(res.error.message || 'Error al solicitar el cambio de correo');
        }
        return { success: true };
    },

    changePassword: async (body: { currentPassword: string; newPassword: string }) => {
        const { data, error } = await api.profile.security.password.post(body);
        if (error) throwApiError(error);
        return data!;
    },

    verifyMfa: async (code: string) => {
        const { data, error } = await api.profile.security.mfa.verify.post({ code });
        if (error) throwApiError(error);
        return data!;
    },

    getMySessions: async () => {
        const { data, error } = await api.profile.sessions.get();
        if (error) throwApiError(error);
        return data!;
    },

    revokeMySession: async (sessionId: string) => {
        const { data, error } = await api.profile.sessions({ id: sessionId }).delete();
        if (error) throwApiError(error);
        return data!;
    },
};
