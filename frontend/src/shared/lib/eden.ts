import { treaty } from '@elysiajs/eden';
import type { App } from '@backend/server';

// Generates a unique ID for this tab instance.
// Falls back to timestamp+random when crypto.randomUUID() is unavailable
// (e.g. non-secure HTTP contexts like LAN IP access during development).

// export const clientId = crypto.randomUUID();
export const clientId = (() => {
    try {
        return crypto.randomUUID();
    } catch {
        return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
    }
})();

import { setOnlineStatus } from '@shared/hooks/useOnlineStatus';

export const api = treaty<App>(import.meta.env.VITE_API_URL || 'http://localhost:3000', {
    fetcher: async (url, options) => {
        // Automatically inject client ID to all requests
        const headers = new Headers(options?.headers);
        headers.set('x-client-id', clientId);

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
                if (typeof window !== 'undefined' && !window.location.pathname.startsWith('/login')) {
                    window.dispatchEvent(new CustomEvent('auth:unauthorized'));
                }
            }
            
            return response;
        } catch (error) {
            // Si ocurre un error de red (p. ej., ERR_FAILED o ERR_INTERNET_DISCONNECTED)
            console.warn('⚠️ Fallo en la petición de red (API inalcanzable). Forzando estado offline.');
            setOnlineStatus(false);
            throw error;
        }
    }
});
