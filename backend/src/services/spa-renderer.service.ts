import { adminDb } from '../db';
import { companies } from '@app/schema/tables';
import { eq } from '@app/schema';
import type { TenantBrandingResponseDtoType } from '@app/schema/backend';
import { env } from '../config/env';

// Cache in-memory in production
let cachedHtml: string | null = null;

// Subdomain and tenant resolver
export function resolveSlugFromHost(host: string, querySlug?: string | null): string | null {
    const hostWithoutPort = host.split(':')[0];
    
    const ipRegex = /^[0-9.]+$/;
    const isIpOrLocal = ipRegex.test(hostWithoutPort) || 
                        hostWithoutPort === 'localhost' || 
                        hostWithoutPort === '127.0.0.1';
    
    if (isIpOrLocal) {
        return querySlug || null;
    }
    
    const parts = hostWithoutPort.split('.');
    
    if (hostWithoutPort.includes('zelys.app')) {
        if (parts.length > 2 && parts[0] !== 'api' && parts[0] !== 'in' && parts[0] !== 'www') {
            return parts[0];
        }
        return null;
    }
    
    if (parts.length > 1 && parts[parts.length - 1] === 'localhost') {
        return parts[0];
    }
    
    if (parts.length > 2) {
        return parts[0];
    }
    
    return null;
}

// Contrast color calculation (luminance-based)
function getContrastColor(hex: string): string {
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
}

// Background theme presets
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

// Fetch index.html from frontend server (decoupled, zero disk volume sharing needed)
async function getRawHtml(requestHost?: string): Promise<string> {
    if (cachedHtml && env.NODE_ENV === 'production') {
        return cachedHtml;
    }
    
    let baseUrl = env.FRONTEND_INTERNAL_URL;
    
    if (!baseUrl && requestHost) {
        const hostWithoutPort = requestHost.split(':')[0];
        const protocol = hostWithoutPort.includes('localhost') || /^[0-9.]+$/.test(hostWithoutPort) ? 'http' : 'https';
        baseUrl = `${protocol}://${requestHost}`;
    }
    
    if (!baseUrl) {
        baseUrl = env.FRONTEND_URL || 'http://localhost:5173';
    }
    
    try {
        const response = await fetch(`${baseUrl}/index.html`, {
            headers: { 'X-Raw-Request': 'true' }
        });
        if (!response.ok) {
            throw new Error(`Failed to fetch raw index.html from ${baseUrl}/index.html: ${response.statusText}`);
        }
        const html = await response.text();
        if (env.NODE_ENV === 'production') {
            cachedHtml = html;
        }
        return html;
    } catch (err) {
        console.error('❌ Error fetching index.html template from frontend:', err);
        // Serve a minimal emergency fallback HTML rather than crashing
        return `<!DOCTYPE html><html><head><title>Zelys - Error</title></head><body><p>Error de conexión con el frontend. Por favor recarga la página.</p></body></html>`;
    }
}

// Wildcard Elysia route handler for serving the branded SPA index.html
export async function serveSpa({ request, query, set }: { request: Request; query: Record<string, string | undefined>; set: any }) {
    const url = new URL(request.url);
    
    // Safety check: Never serve SPA for broken /api/ endpoints
    if (url.pathname.startsWith('/api/')) {
        set.status = 404;
        return { error: 'Not Found', details: 'Endpoint not registered under /api' };
    }
    
    const originalHost = request.headers.get('x-original-host') || request.headers.get('host') || '';
    const slug = resolveSlugFromHost(originalHost, query.slug);
    
    let html = await getRawHtml(originalHost);
    
    if (slug) {
        try {
            const [company] = await adminDb
                .select({
                    id: companies.id,
                    slug: companies.slug,
                    businessName: companies.business_name,
                    tradeName: companies.trade_name,
                    logoUrl: companies.logo_url,
                    primaryColor: companies.primary_color,
                    secondaryColor: companies.secondary_color,
                    loginBgUrl: companies.login_bg_url,
                    isActive: companies.is_active,
                })
                .from(companies)
                .where(eq(companies.slug, slug))
                .limit(1);

            if (company && company.isActive) {
                const theme = THEME_PRESETS[company.secondaryColor] || THEME_PRESETS['#64748b'];
                const onPrimary = getContrastColor(company.primaryColor);
                const onSecondary = getContrastColor(company.secondaryColor);
                
                let headInjections = '\n<!-- Pre-inyectado por Elysia SPA Renderer -->';
                
                // 1. CSS Custom Properties for tenant styling
                headInjections += `
<style id="tenant-branding">
  :root {
    --primary: ${company.primaryColor} !important;
    --on-primary: ${onPrimary} !important;
    --secondary: ${company.secondaryColor} !important;
    --on-secondary: ${onSecondary} !important;
    --bg-light-val: ${theme.bgLight} !important;
    --bg-dark-val: ${theme.bgDark} !important;
    --surface-light-val: ${theme.surfaceLight} !important;
    --surface-dark-val: ${theme.surfaceDark} !important;
    --card-light-val: ${theme.surfaceLight} !important;
    --card-dark-val: ${theme.surfaceDark} !important;
    --card-alt-light-val: ${theme.cardAltLight} !important;
    --card-alt-dark-val: ${theme.cardAltDark} !important;
    --border-light-val: ${theme.borderLight} !important;
    --border-dark-val: ${theme.borderDark} !important;
  }
</style>
`;
                
                // 2. Pre-injected branding JSON data for SolidJS store hydration
                const tenantData: TenantBrandingResponseDtoType = {
                    id: company.id,
                    slug: company.slug,
                    businessName: company.businessName,
                    tradeName: company.tradeName || company.businessName,
                    logoUrl: company.logoUrl,
                    primaryColor: company.primaryColor,
                    secondaryColor: company.secondaryColor,
                    loginBgUrl: company.loginBgUrl,
                };
                
                headInjections += `
<script id="tenant-data" type="application/json">
  ${JSON.stringify(tenantData)}
</script>
`;
                
                // 3. Dynamic manifest link (crossorigin API endpoint)
                const apiUrl = process.env.VITE_API_URL || 'http://localhost:3000';
                headInjections += `
<link rel="manifest" crossorigin="use-credentials" href="${apiUrl}/auth/tenant-manifest?slug=${company.slug}" />
`;
                
                // 4. Favicon and shortcut icons
                if (company.logoUrl) {
                    headInjections += `
<link rel="shortcut icon" href="${company.logoUrl}">
<link rel="icon" type="image/png" sizes="192x192" href="${company.logoUrl}">
<link rel="apple-touch-icon" href="${company.logoUrl}">
`;
                } else {
                    headInjections += `
<link rel="shortcut icon" href="/favicon.ico">
`;
                }
                
                // Inyectamos todo en el head del index.html
                html = html.replace('</head>', `${headInjections}\n</head>`);
                
                // 5. Title tag dynamic replacement
                const titleText = `${company.tradeName || company.businessName} - Iniciar Sesión`;
                html = html.replace(/<title>.*?<\/title>/, `<title>${titleText}</title>`);
            } else {
                // Tenant not found or inactive, fall back to default manifest
                html = html.replace('</head>', `\n<link rel="manifest" href="/manifest.webmanifest" />\n</head>`);
            }
        } catch (dbError) {
            console.error('❌ Error resolving tenant from database in SPA renderer:', dbError);
            // Fallback gracefully on DB error: serve unbranded index.html and let client handle it
            html = html.replace('</head>', `\n<link rel="manifest" href="/manifest.webmanifest" />\n</head>`);
        }
    } else {
        // No tenant resolved (landing page or default site), fall back to default manifest
        html = html.replace('</head>', `\n<link rel="manifest" href="/manifest.webmanifest" />\n</head>`);
    }
    
    set.headers['content-type'] = 'text/html; charset=utf-8';
    return html;
}
