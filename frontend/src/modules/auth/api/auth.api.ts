// src/modules/auth/auth.api.ts
import { LoginRequest, LoginResponse, TokenResponse, AuthError, User } from "../types/auth.types";
import { api } from '@shared/lib/eden';

export const authApi = {
    login: async (credentials: LoginRequest, signal?: AbortSignal): Promise<LoginResponse> => {
        const response = await api.api.auth.login.post(credentials, { fetch: { signal } });
        const { data, error } = response;
        if (error) throw new AuthError(error.value, 'Login fallido');
        if (!data) throw new AuthError('No data received');
        // Eden sometimes infers 'Response' in the union if fetch config is involved, force cast safe data
        return data as LoginResponse;
    },

    refreshToken: async (signal?: AbortSignal): Promise<TokenResponse> => {
        const response = await api.api.auth.refresh.post({}, { fetch: { signal } });
        const { data, error } = response;
        if (error) throw new AuthError(error.value, 'Refresh fallido');
        if (!data) throw new AuthError('No data received');
        return data as TokenResponse;
    },

    logout: async (signal?: AbortSignal): Promise<void> => {
        try {
            await api.api.auth.logout.post({}, { fetch: { signal } });
        } catch (e) {
            if (e instanceof Error && e.name === 'AbortError') return;
            console.warn('Logout request failed', e);
        }
    },

    getMe: async (token: string, signal?: AbortSignal): Promise<User> => {
        const response = await api.api.auth.me.get({
            headers: { Authorization: `Bearer ${token}` },
            fetch: { signal }
        });
        const { data, error } = response;
        if (error) throw new AuthError(error.value, 'Error obteniendo usuario');
        if (!data) throw new AuthError('No data received');
        return data as User;
    }
};