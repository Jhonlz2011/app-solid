/**
 * auth.api.ts — Eden API fetchers for Auth module
 *
 * Login, logout, register, slug/ruc checks.
 * Type-safe — payload types inferred from backend schema contracts.
 */
import { api } from '@shared/lib/eden';
import { AuthError } from '../types/auth-error';
import type { AuthRegisterDtoType } from '@app/schema/backend';

export const authApi = {
    login: async (credentials: { email: string; password: string }, signal?: AbortSignal) => {
        const { data, error } = await api.api.auth.login.post(credentials, { fetch: { signal } });
        if (error) throw new AuthError(error.value, 'Login fallido');
        return data!;
    },

    register: async (payload: AuthRegisterDtoType, signal?: AbortSignal) => {
        const { data, error } = await api.api.auth.register.post(payload, { fetch: { signal } });
        if (error) throw new AuthError(error.value, 'Registro fallido');
        return data!;
    },

    checkSlug: async (slug: string) => {
        const { data, error } = await api.api.auth['check-slug']({ slug }).get();
        if (error) throw new AuthError(error.value, 'Error verificando slug');
        return data!;
    },

    checkRuc: async (ruc: string) => {
        const { data, error } = await api.api.auth['check-ruc']({ ruc }).get();
        if (error) throw new AuthError(error.value, 'Error verificando RUC');
        return data!;
    },

    getTenantInfo: async (slug?: string) => {
        const { data, error } = await api.api.auth['tenant-info'].get({ query: { slug } });
        if (error) throw new AuthError(error.value, 'Error al obtener información corporativa');
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