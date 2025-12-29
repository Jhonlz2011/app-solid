// src/modules/auth/auth.api.ts
import { LoginRequest, LoginResponse, TokenResponse, AuthError, ApiError, User } from "./models/auth.types";

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

export const authApi = {
    login: async (credentials: LoginRequest, signal?: AbortSignal): Promise<LoginResponse> => {
        const res = await fetch(`${API_URL}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
            credentials: 'include', // Para cookie httpOnly
            body: JSON.stringify(credentials),
            signal,
        });

        const data = await res.json();
        if (!res.ok) throw new AuthError((data as ApiError).error || 'Login fallido');
        return data as LoginResponse;
    },

    refreshToken: async (signal?: AbortSignal): Promise<TokenResponse> => {
        const res = await fetch(`${API_URL}/auth/refresh`, {
            method: 'POST',
            credentials: 'include',
            signal,
        });

        const data = await res.json();
        if (!res.ok) throw new AuthError((data as ApiError).error || 'Refresh fallido');
        return data as TokenResponse;
    },

    logout: async (signal?: AbortSignal): Promise<void> => {
        try {
            await fetch(`${API_URL}/auth/logout`, {
                method: 'POST',
                credentials: 'include',
                signal,
            });
        } catch (e) {
            // Ignore abort errors silently
            if (e instanceof Error && e.name === 'AbortError') return;
            console.warn('Logout request failed', e);
        }
    },

    getMe: async (token: string, signal?: AbortSignal): Promise<User> => {
        const res = await fetch(`${API_URL}/auth/me`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Accept': 'application/json'
            },
            signal,
        });

        const data = await res.json();
        if (!res.ok) throw new AuthError((data as ApiError).error || 'Error obteniendo usuario');
        return data as User;
    }
};