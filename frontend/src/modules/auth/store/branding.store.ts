import { createStore } from "solid-js/store";
import { authApi } from "../api/auth.api";
import type { TenantBrandingResponseDtoType } from '@app/schema/backend';

interface BrandingState {
    tenant: TenantBrandingResponseDtoType | null;
    loading: boolean;
    error: string | null;
}

const [state, setState] = createStore<BrandingState>({
    tenant: null,
    loading: false,
    error: null,
});

export const getSubdomain = (): string | null => {
    const host = window.location.hostname;
    if (host === 'localhost' || host === '127.0.0.1') {
        const params = new URLSearchParams(window.location.search);
        return params.get('slug') || null;
    }
    const parts = host.split('.');
    
    // Producción: tenant.zelys.app
    if (host.includes('zelys.app')) {
        if (parts.length > 2 && parts[0] !== 'api' && parts[0] !== 'in' && parts[0] !== 'www') {
            return parts[0];
        }
        return null;
    }
    
    // Local development con subdominios: tenant.localhost
    if (parts.length > 1 && parts[parts.length - 1] === 'localhost') {
        return parts[0];
    }
    return parts[0];
};

export const applyBranding = (tenant: TenantBrandingResponseDtoType | null) => {
    const root = document.documentElement;
    if (tenant) {
        root.style.setProperty('--primary', tenant.primaryColor);
        root.style.setProperty('--secondary', tenant.secondaryColor);
        
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
        
        // Dynamic manifest updating via ObjectURL Blob (En enfoque frontend)
        const manifest = {
            name: tenant.businessName,
            short_name: tenant.tradeName || tenant.businessName,
            start_url: window.location.origin,
            display: 'standalone',
            background_color: '#ffffff',
            theme_color: tenant.primaryColor,
            icons: [
                {
                    src: tenant.logoUrl,
                    sizes: '192x192',
                    type: 'image/png',
                    purpose: 'any maskable'
                },
                {
                    src: tenant.logoUrl,
                    sizes: '512x512',
                    type: 'image/png',
                    purpose: 'any maskable'
                }
            ]
        };
        const stringManifest = JSON.stringify(manifest);
        const blob = new Blob([stringManifest], { type: 'application/manifest+json' });
        const manifestURL = URL.createObjectURL(blob);
        
        let link = document.querySelector('link[rel="manifest"]') as HTMLLinkElement;
        if (!link) {
            link = document.createElement('link');
            link.rel = 'manifest';
            document.head.appendChild(link);
        }
        link.href = manifestURL;
        
    } else {
        root.style.removeProperty('--primary');
        root.style.removeProperty('--secondary');
        document.title = 'Zelys - Plataforma de Gestión';
        
        // Restore default manifest
        let link = document.querySelector('link[rel="manifest"]') as HTMLLinkElement;
        if (link) {
            link.href = '/manifest.json'; // Default path
        }
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

        setState('loading', true);
        try {
            const tenantInfo = await authApi.getTenantInfo(slug);
            setState({ tenant: tenantInfo, error: null });
            applyBranding(tenantInfo);
        } catch (err: any) {
            console.error('Error al resolver branding del tenant:', err);
            setState({ tenant: null, error: err.message || 'Error resolviendo branding' });
            applyBranding(null);
        } finally {
            setState('loading', false);
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
