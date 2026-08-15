/**
 * auth.api.ts — Eden API fetchers for Auth module
 *
 * Login, logout, register, slug/ruc checks.
 * Type-safe — payload types inferred from backend schema contracts.
 */
import { api } from '@shared/lib/eden';
import { throwApiError } from '@shared/utils/api-errors';
import type { AuthRegisterPayload } from '@app/schema/dto';

export const authApi = {
    login: async (credentials: { email: string; password: string; companyId?: number; turnstileToken?: string }, signal?: AbortSignal) => {
        const { data, error } = await api.api.auth.login.post(credentials, { fetch: { signal } });
        if (error) throwApiError(error);
        return data!;
    },

    register: async (payload: AuthRegisterPayload, signal?: AbortSignal) => {
        const { data, error } = await api.api.auth.register.post(payload, { fetch: { signal } });
        if (error) throwApiError(error);
        return data!;
    },

    checkSlug: async (slug: string) => {
        const { data, error } = await api.api.auth['check-slug']({ slug }).get();
        if (error) throwApiError(error);
        return data!;
    },

    checkRuc: async (ruc: string) => {
        const { data, error } = await api.api.auth['check-ruc']({ ruc }).get();
        if (error) throwApiError(error);
        return data!;
    },

    getTenantInfo: async (slug?: string) => {
        const { data, error } = await api.api.auth['tenant-info'].get({ query: { slug } });
        if (error) throwApiError(error);
        return data!;
    },

    logout: async (signal?: AbortSignal): Promise<void> => {
        try {
            await api.api.auth.logout.post({}, { fetch: { signal } });
        } catch (e) {
            if (e instanceof Error && e.name === 'AbortError') return;
            console.warn('Logout request failed', e);
        }
    },
};