// src/modules/auth/auth.api.ts
import { LoginResponse, AuthError, User } from "../types/auth.types";
import { api } from '@shared/lib/eden';

export const authApi = {
    login: async (credentials: { email: string; password: string }, signal?: AbortSignal): Promise<LoginResponse> => {
        const response = await api.api.auth.login.post(credentials, { fetch: { signal } });
        const { data, error } = response;
        if (error) throw new AuthError(error.value, 'Login fallido');
        if (!data) throw new AuthError('No data received');
        return data as LoginResponse;
    },

    logout: async (signal?: AbortSignal): Promise<void> => {
        try {
            await api.api.auth.logout.post({}, { fetch: { signal } });
        } catch (e) {
            if (e instanceof Error && e.name === 'AbortError') return;
            console.warn('Logout request failed', e);
        }
    },

    getMe: async (signal?: AbortSignal): Promise<User> => {
        const response = await api.api.auth.me.get({
            fetch: { signal }
        });
        const { data, error } = response;
        if (error) throw new AuthError(error.value, 'Error obteniendo usuario');
        if (!data) throw new AuthError('No data received');
        return data as User;
    }
};