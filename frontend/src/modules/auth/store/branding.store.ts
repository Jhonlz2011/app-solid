import { createStore } from "solid-js/store";
import { authApi } from "../api/auth.api";
import type { TenantBrandingResponseDtoType } from '@app/schema/backend';
import { getContrastColor } from '@app/schema/utils/color';
import { THEME_PRESETS } from '@app/schema/utils';
import { resolveSlugFromHost } from '@app/schema/utils';


interface BrandingState {
    tenant: TenantBrandingResponseDtoType | null;
    loading: boolean;
    error: string | null;
}

export const getSubdomain = (): string | null =>
    resolveSlugFromHost(
        window.location.hostname,
        new URLSearchParams(window.location.search).get('slug'),
    );

const getInitialTenant = (): TenantBrandingResponseDtoType | null => {
    if (typeof window === 'undefined') return null;
    const serverDataElement = document.getElementById("tenant-data");
    if (serverDataElement) {
        try {
            return JSON.parse(serverDataElement.textContent || "");
        } catch (e) {
            console.error("Error parsing server-injected tenant-data:", e);
        }
    }
    const slug = getSubdomain();
    if (!slug) return null;
    const cached = localStorage.getItem(`branding:${slug}`);
    if (cached) {
        try {
            return JSON.parse(cached);
        } catch {
            return null;
        }
    }
    return null;
};

const [state, setState] = createStore<BrandingState>({
    tenant: getInitialTenant(),
    loading: false,
    error: null,
});

export const applyBranding = (tenant: TenantBrandingResponseDtoType | null) => {
    const updateDOM = () => {
        setState('tenant', tenant);
        const root = document.documentElement;
        if (tenant) {
            root.style.setProperty('--primary', tenant.primaryColor);
            root.style.setProperty('--on-primary', getContrastColor(tenant.primaryColor));
            root.style.setProperty('--secondary', tenant.themeColor);
            root.style.setProperty('--on-secondary', getContrastColor(tenant.themeColor));

            // Apply background theme variables based on secondary color
            const theme = THEME_PRESETS[tenant.themeColor] || THEME_PRESETS['#64748b'];
            root.style.setProperty('--bg-light-val', theme.bgLight);
            root.style.setProperty('--bg-dark-val', theme.bgDark);
            root.style.setProperty('--surface-light-val', theme.surfaceLight);
            root.style.setProperty('--surface-dark-val', theme.surfaceDark);
            root.style.setProperty('--card-light-val', theme.cardLight);
            root.style.setProperty('--card-dark-val', theme.cardDark);
            root.style.setProperty('--card-alt-light-val', theme.cardAltLight);
            root.style.setProperty('--card-alt-dark-val', theme.cardAltDark);
            root.style.setProperty('--border-light-val', theme.borderLight);
            root.style.setProperty('--border-dark-val', theme.borderDark);
            
            document.title = `${tenant.tradeName || tenant.businessName} - Iniciar Sesión`;
            if (tenant.logoUrl) {
                let favicon = document.querySelector("link[rel*='icon']") as HTMLLinkElement;
                if (!favicon) {
                    favicon = document.createElement('link');
                    favicon.rel = 'shortcut icon';
                    document.head.appendChild(favicon);
                }
                favicon.href = tenant.logoUrl;
            }
            
            // Dynamic manifest updating via absolute backend endpoint (crossorigin)
            let link = document.querySelector('link[rel="manifest"]') as HTMLLinkElement;
            if (!link) {
                link = document.createElement('link');
                link.rel = 'manifest';
                document.head.appendChild(link);
            }
            link.setAttribute('crossorigin', 'use-credentials');
            const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000';
            link.href = `${apiUrl}/api/auth/tenant-manifest?slug=${tenant.slug}`;
            
        } else {
            root.style.removeProperty('--primary');
            root.style.removeProperty('--on-primary');
            root.style.removeProperty('--secondary');
            root.style.removeProperty('--on-secondary');

            // Remove background theme variables
            root.style.removeProperty('--bg-light-val');
            root.style.removeProperty('--bg-dark-val');
            root.style.removeProperty('--surface-light-val');
            root.style.removeProperty('--surface-dark-val');
            root.style.removeProperty('--card-light-val');
            root.style.removeProperty('--card-dark-val');
            root.style.removeProperty('--card-alt-light-val');
            root.style.removeProperty('--card-alt-dark-val');
            root.style.removeProperty('--border-light-val');
            root.style.removeProperty('--border-dark-val');

            document.title = 'Zelys - Plataforma de Gestión';
            
            // Restore default manifest
            let link = document.querySelector('link[rel="manifest"]') as HTMLLinkElement;
            if (link) {
                link.removeAttribute('crossorigin');
                link.href = '/manifest.webmanifest'; // Default build PWA manifest path
            }
        }
    };

    // Smooth transition animations via native browser API (2026 standard)
    if (typeof document !== 'undefined' && 'startViewTransition' in document) {
        (document as any).startViewTransition(updateDOM);
    } else {
        updateDOM();
    }
};

export const brandingActions = {
    loadBranding: async () => {
        const slug = getSubdomain();
        if (!slug) {
            setState({ tenant: null, loading: false });
            applyBranding(null);
            return;
        }

        // If pre-hydrated from the server, save/sync silently in the background
        const initialTenant = state.tenant;
        if (initialTenant && initialTenant.slug === slug) {
            localStorage.setItem(`branding:${slug}`, JSON.stringify(initialTenant));
            
            // Skip sync if data was SSR-injected (always fresh from the DB, max 2 min TTL).
            // Only do background sync if data came from localStorage cache (stale from a previous session).
            const wasSSRInjected = !!document.getElementById('tenant-data');
            if (!wasSSRInjected) {
                try {
                    const tenantInfo = await authApi.getTenantInfo(slug);
                    localStorage.setItem(`branding:${slug}`, JSON.stringify(tenantInfo));
                    if (JSON.stringify(tenantInfo) !== JSON.stringify(initialTenant)) {
                        applyBranding(tenantInfo);
                    }
                } catch (err) {
                    console.warn('Silent branding background sync failed:', err);
                }
            }
            return;
        }

        // Fallback standard load (primarily for development environment)
        setState('loading', true);
        try {
            const tenantInfo = await authApi.getTenantInfo(slug);
            setState({ tenant: tenantInfo, error: null });
            localStorage.setItem(`branding:${slug}`, JSON.stringify(tenantInfo));
            applyBranding(tenantInfo);
        } catch (err: any) {
            console.error('Error al resolver branding del tenant:', err);
            setState({ tenant: null, error: err.message || 'Error resolviendo branding' });
            applyBranding(null);
        } finally {
            setState('loading', false);
        }
    },

    /**
     * Load branding for a specific slug (post-login sync).
     * Used when a user logs in via zelys.app (no subdomain) and we know their
     * companySlug from getMe(). Allows the sidebar to show the tenant's logo.
     */
    loadBrandingForSlug: async (slug: string) => {
        // Skip if already loaded for this slug
        if (state.tenant?.slug === slug) return;

        try {
            const tenantInfo = await authApi.getTenantInfo(slug);
            setState({ tenant: tenantInfo, error: null });
            localStorage.setItem(`branding:${slug}`, JSON.stringify(tenantInfo));
            applyBranding(tenantInfo);
        } catch (err: any) {
            console.warn('Branding sync for slug failed:', err);
        }
    }
};

export const useBranding = () => {
    return {
        tenant: () => state.tenant,
        isLoading: () => state.loading,
        error: () => state.error,
    };
};
