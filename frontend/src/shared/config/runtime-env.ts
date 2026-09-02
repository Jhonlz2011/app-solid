/**
 * runtime-env.ts — Single Source of Truth for Client Runtime Configuration
 *
 * Resolves API, SSE, and Service endpoints dynamically:
 * 1. Server-injected config (<script id="app-config"> or <script id="tenant-data">)
 * 2. Multi-tenant hostname inference (*.zelys.app -> https://api.zelys.app)
 * 3. Vite Build-time env vars (import.meta.env.VITE_*)
 * 4. Localhost dev fallback (http://localhost:3000)
 */

interface ServerRuntimeConfig {
    apiUrl?: string;
    sseUrl?: string;
    cdnUrl?: string;
    turnstileSiteKey?: string;
}

function parseInjectedConfig(): ServerRuntimeConfig | null {
    if (typeof window === 'undefined') return null;

    // 1. Try dedicated #app-config script
    const configEl = document.getElementById('app-config');
    if (configEl?.textContent) {
        try {
            const parsed = JSON.parse(configEl.textContent);
            if (parsed && typeof parsed === 'object') {
                return parsed;
            }
        } catch (e) {
            console.warn('[Config] Failed to parse #app-config:', e);
        }
    }

    // 2. Fallback: check #tenant-data script (injected by Elysia SPA renderer)
    const tenantEl = document.getElementById('tenant-data');
    if (tenantEl?.textContent) {
        try {
            const data = JSON.parse(tenantEl.textContent);
            if (data && typeof data === 'object') {
                return {
                    apiUrl: data.apiUrl,
                    sseUrl: data.sseUrl,
                    cdnUrl: data.cdnUrl,
                    turnstileSiteKey: data.turnstileSiteKey,
                };
            }
        } catch (e) {
            console.warn('[Config] Failed to parse #tenant-data:', e);
        }
    }

    return null;
}

// Cached parsed config from initial page load
let cachedInjected: ServerRuntimeConfig | null | undefined = undefined;

function getInjected(): ServerRuntimeConfig | null {
    if (cachedInjected === undefined) {
        cachedInjected = parseInjectedConfig();
    }
    return cachedInjected;
}

export const getApiUrl = (): string => {
    const injected = getInjected();
    if (injected?.apiUrl) return injected.apiUrl;

    if (typeof window !== 'undefined') {
        const hostname = window.location.hostname;
        // Production multi-tenant domain (*.zelys.app or root zelys.app)
        if (hostname.endsWith('zelys.app') || hostname === 'zelys.app' || hostname === 'www.zelys.app') {
            return 'https://api.zelys.app';
        }
    }

    if (import.meta.env.VITE_API_URL) {
        return import.meta.env.VITE_API_URL;
    }

    return import.meta.env.DEV ? 'http://localhost:3000' : 'https://api.zelys.app';
};

export const getSseUrl = (): string => {
    const injected = getInjected();
    if (injected?.sseUrl) return injected.sseUrl;

    if (typeof window !== 'undefined') {
        const hostname = window.location.hostname;
        if (hostname.endsWith('zelys.app') || hostname === 'zelys.app' || hostname === 'www.zelys.app') {
            return 'https://api.zelys.app/api/sse';
        }
    }

    if (import.meta.env.VITE_SSE_URL) {
        return import.meta.env.VITE_SSE_URL;
    }

    const baseApi = getApiUrl();
    return `${baseApi}/api/sse`;
};

export const getTurnstileSiteKey = (): string => {
    const injected = getInjected();
    if (injected?.turnstileSiteKey) return injected.turnstileSiteKey;

    return import.meta.env.VITE_TURNSTILE_SITE_KEY || '0x4AAAAAADisKN0OYEK9RMwL';
};

export const runtimeConfig = {
    get apiUrl() { return getApiUrl(); },
    get sseUrl() { return getSseUrl(); },
    get turnstileSiteKey() { return getTurnstileSiteKey(); },
    isDev: import.meta.env.DEV,
    isProd: import.meta.env.PROD,
};
