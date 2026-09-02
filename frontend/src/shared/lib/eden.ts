import { treaty } from '@elysiajs/eden';
import type { App } from '@backend/server';

// Generates a unique ID for this tab instance.
export const clientId = (() => {
    try {
        return crypto.randomUUID();
    } catch {
        return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
    }
})();

import { setOnlineStatus } from '@shared/hooks/useOnlineStatus';
import { getApiUrl } from '../config/runtime-env';
import { resolveSlugFromHost } from '@app/schema/utils';

const rawBase = getApiUrl();

const client = treaty<App>(rawBase, {
    fetcher: async (url, options) => {
        // Automatically inject client ID and tenant context to all requests
        const headers = new Headers(options?.headers);
        headers.set('x-client-id', clientId);

        if (typeof window !== 'undefined') {
            const currentSlug = resolveSlugFromHost(window.location.hostname);
            if (currentSlug) {
                headers.set('x-tenant-slug', currentSlug);
            }
        }

        try {
            const response = await fetch(url, {
                ...options,
                headers,
                credentials: 'include',
            });
            // Si la llamada tuvo éxito, nos aseguramos de marcar el estado como conectado
            setOnlineStatus(true);
            // GLOBAL 401 INTERCEPTOR (Catches API drops before TanStack Query morphs them)
            if (response.status === 401) {
                if (typeof window !== 'undefined' && !window.location.pathname.startsWith('/login') && !window.location.pathname.startsWith('/register')) {
                    window.dispatchEvent(new CustomEvent('auth:unauthorized'));
                }
            }
            return response;
        } catch (error) {
            // fetch() solo llega al catch con errores de red (TypeError: Failed to fetch),
            // nunca con errores HTTP (4xx/5xx). Es seguro marcar offline aquí.
            if (error instanceof TypeError) {
                setOnlineStatus(false);
            }
            throw error;
        }
    }
});

export const api = client.api;
