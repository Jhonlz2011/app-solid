import { getAccessToken, actions } from '@modules/auth/auth.store';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

interface RequestOptions extends RequestInit {
    params?: Record<string, any>;
}

export async function request<T>(endpoint: string, options: RequestOptions = {}): Promise<T> {
    const { params, ...init } = options;

    let url = `${API_URL}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;

    if (params) {
        const query = new URLSearchParams();
        Object.entries(params).forEach(([key, value]) => {
            if (value !== undefined && value !== null && value !== '') {
                query.append(key, String(value));
            }
        });
        const queryString = query.toString();
        if (queryString) {
            url += `?${queryString}`;
        }
    }

    const headers = new Headers(init.headers);

    if (!headers.has('Content-Type') && !(init.body instanceof FormData)) {
        headers.set('Content-Type', 'application/json');
    }

    const token = getAccessToken();
    if (token) {
        headers.set('Authorization', `Bearer ${token}`);
    }

    const config: RequestInit = {
        ...init,
        headers,
        credentials: 'include',
    };

    let response = await fetch(url, config);

    if (response.status === 401) {
        console.log('[HTTP] Got 401, attempting token refresh...');
        try {
            const newToken = await actions.refresh();
            console.log('[HTTP] Token refreshed, retrying request...');
            headers.set('Authorization', `Bearer ${newToken}`);
            response = await fetch(url, { ...config, headers });
            console.log('[HTTP] Retry response status:', response.status);

            // If still 401 after retry with fresh token, it's a real auth error (e.g., wrong password)
            // Throw immediately - don't let it fall through to the generic error handler
            if (response.status === 401) {
                console.log('[HTTP] Still 401 after retry, throwing error...');
                const errorData = await response.json().catch(() => ({}));
                console.log('[HTTP] Error data:', errorData);
                throw new Error(errorData.error || errorData.message || 'Error de autenticación');
            }
        } catch (error) {
            // Refresh failed or second request failed
            console.log('[HTTP] Error in 401 handler:', error);
            throw error;
        }
    }

    if (response.status === 204) {
        return {} as T;
    }

    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || errorData.message || `Error ${response.status}`);
    }

    return response.json();
}
