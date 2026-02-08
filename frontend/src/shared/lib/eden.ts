import { treaty } from '@elysiajs/eden';
import type { App } from '@backend/server';
import { getAccessToken } from '@modules/auth/store/auth.store';

export const api = treaty<App>(import.meta.env.VITE_API_URL || 'http://localhost:3000', {
    fetch: {
        credentials: 'include', // Include cookies for refresh token
    },
    // Use onRequest hook for adding Authorization header
    onRequest: (path, options) => {
        const token = getAccessToken();
        if (token) {
            const headers = new Headers(options.headers);
            headers.set('Authorization', `Bearer ${token}`);
            return { ...options, headers };
        }
        return options;
    },
});
