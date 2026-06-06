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
    
    // 1. Excluir IPs de desarrollo (IPv4 como 192.168.x.x o 127.0.0.1)
    const ipRegex = /^[0-9.]+$/;
    if (ipRegex.test(host)) {
        const params = new URLSearchParams(window.location.search);
        return params.get('slug') || null;
    }
    
    // 2. Comportamiento estándar de localhost
    if (host === 'localhost') {
        const params = new URLSearchParams(window.location.search);
        return params.get('slug') || null;
    }
    
    const parts = host.split('.');
    
    // 3. Producción en zelys.app (*.zelys.app)
    if (host.includes('zelys.app')) {
        if (parts.length > 2 && parts[0] !== 'api' && parts[0] !== 'in' && parts[0] !== 'www') {
            return parts[0];
        }
        return null;
    }
    
    // 4. Desarrollo local con subdominios (ej: acme.localhost)
    if (parts.length > 1 && parts[parts.length - 1] === 'localhost') {
        return parts[0];
    }
    
    // 5. Otros dominios
    if (parts.length > 2) {
        return parts[0];
    }
    
    return null;
};

const getContrastColor = (hex: string): string => {
    try {
        const cleanHex = hex.replace('#', '');
        const r = parseInt(cleanHex.substring(0, 2), 16);
        const g = parseInt(cleanHex.substring(2, 4), 16);
        const b = parseInt(cleanHex.substring(4, 6), 16);
        
        if (isNaN(r) || isNaN(g) || isNaN(b)) {
            return '#ffffff';
        }

        const toLinear = (c: number) => {
            const s = c / 255;
            return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
        };
        
        const l = 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
        return l > 0.179 ? '#0f172a' : '#ffffff';
    } catch {
        return '#ffffff';
    }
};

const THEME_PRESETS: Record<string, {
    bgLight: string;
    bgDark: string;
    surfaceLight: string;
    surfaceDark: string;
    cardAltLight: string;
    cardAltDark: string;
    borderLight: string;
    borderDark: string;
}> = {
    // Cool Blue (#3b82f6)
    '#3b82f6': {
        bgLight: '#f4f7fb',
        bgDark: '#020617',
        surfaceLight: '#ffffff',
        surfaceDark: '#0f172a',
        cardAltLight: '#eef2ff',
        cardAltDark: '#1e293b',
        borderLight: '#e7eff8',
        borderDark: '#1f2533',
    },
    // Eco Green (#10b981)
    '#10b981': {
        bgLight: '#f0f7f4',
        bgDark: '#051c14',
        surfaceLight: '#ffffff',
        surfaceDark: '#0c2c20',
        cardAltLight: '#e2efe9',
        cardAltDark: '#112d24',
        borderLight: '#e2efe9',
        borderDark: '#183f31',
    },
    // Warm Sand (#f59e0b)
    '#f59e0b': {
        bgLight: '#faf8f5',
        bgDark: '#1c1917',
        surfaceLight: '#ffffff',
        surfaceDark: '#292524',
        cardAltLight: '#f1ebe1',
        cardAltDark: '#383330',
        borderLight: '#f1ebe1',
        borderDark: '#44403c',
    },
    // Slate (#64748b - default)
    '#64748b': {
        bgLight: '#f1f5f9',
        bgDark: '#0f172a',
        surfaceLight: '#ffffff',
        surfaceDark: '#1e293b',
        cardAltLight: '#e2e8f0',
        cardAltDark: '#1f2937',
        borderLight: '#e2e8f0',
        borderDark: '#334155',
    }
};

export const applyBranding = (tenant: TenantBrandingResponseDtoType | null) => {
    setState('tenant', tenant);
    const root = document.documentElement;
    if (tenant) {
        root.style.setProperty('--primary', tenant.primaryColor);
        root.style.setProperty('--on-primary', getContrastColor(tenant.primaryColor));
        root.style.setProperty('--secondary', tenant.secondaryColor);
        root.style.setProperty('--on-secondary', getContrastColor(tenant.secondaryColor));

        // Apply background theme variables based on secondary color
        const theme = THEME_PRESETS[tenant.secondaryColor] || THEME_PRESETS['#64748b'];
        root.style.setProperty('--bg-light-val', theme.bgLight);
        root.style.setProperty('--bg-dark-val', theme.bgDark);
        root.style.setProperty('--surface-light-val', theme.surfaceLight);
        root.style.setProperty('--surface-dark-val', theme.surfaceDark);
        root.style.setProperty('--card-light-val', theme.surfaceLight);
        root.style.setProperty('--card-dark-val', theme.surfaceDark);
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
        link.href = `${apiUrl}/auth/tenant-manifest?slug=${tenant.slug}`;
        
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
