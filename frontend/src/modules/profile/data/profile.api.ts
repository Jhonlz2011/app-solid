/**
 * profile.api.ts — Eden API fetchers for Profile module
 *
 * Strictly fetchers — no hooks, no casts, no error mapping.
 * All return types inferred from backend response schemas.
 */
import { api } from '@shared/lib/eden';
import { throwApiError } from '@shared/utils/api-errors';

export const profileApi = {
    getMe: async () => {
        const { data, error } = await api.api.auth.me.get();
        if (error) throwApiError(error);
        return data!;
    },

    updateProfile: async (body: { username?: string; email?: string }) => {
        const { data, error } = await api.api.auth.profile.put(body);
        if (error) throwApiError(error);
        return data!;
    },

    changePassword: async (body: { currentPassword: string; newPassword: string }) => {
        const { data, error } = await api.api.auth['change-password'].post(body);
        if (error) throwApiError(error);
        return data!;
    },

    getMySessions: async () => {
        const { data, error } = await api.api.auth.sessions.get();
        if (error) throwApiError(error);
        return data!;
    },

    revokeMySession: async (sessionId: string) => {
        const { data, error } = await api.api.auth.sessions({ id: sessionId }).delete();
        if (error) throwApiError(error);
        return data!;
    },
};
