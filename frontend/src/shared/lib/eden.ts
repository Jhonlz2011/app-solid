import { treaty } from '@elysiajs/eden';
import type { App } from '@backend/server';

export const api = treaty<App>(import.meta.env.VITE_API_URL || 'http://localhost:3000', {
    fetcher: async (url, options) => {
        const response = await fetch(url, {
            ...options,
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
