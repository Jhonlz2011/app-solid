import { treaty } from '@elysiajs/eden';
import type { App } from '@backend/server';

// -----------------------------------------------------------------------------
// Global Client ID
// Unique identifier for this browser tab/session instance.
// Used by the backend to echo back events via WebSocket so we can ignore our own
// mutations and prevent double-invalidations.
// -----------------------------------------------------------------------------
export const clientId = crypto.randomUUID();

export const api = treaty<App>(import.meta.env.VITE_API_URL || 'http://localhost:3000', {
    fetcher: async (url, options) => {
        // Automatically inject client ID to all requests
        const headers = new Headers(options?.headers);
        headers.set('x-client-id', clientId);

        const response = await fetch(url, {
            ...options,
            headers,
            credentials: 'include',
        });
        
        // GLOBAL 401 INTERCEPTOR (Catches API drops before TanStack Query morphs them)
        if (response.status === 401) {
            if (typeof window !== 'undefined' && !window.location.pathname.startsWith('/login')) {
                window.dispatchEvent(new CustomEvent('auth:unauthorized'));
            }
        }
        
        return response;
    }
});
