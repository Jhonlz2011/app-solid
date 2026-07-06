import { adminDb } from '../db';
import { companies } from '@app/schema/tables';
import { eq } from '@app/schema';
import type { TenantBrandingResponseDtoType } from '@app/schema/backend';
import { env } from '../config/env';
import { resolveSlugFromHost, getContrastColor, isHexColor, THEME_PRESETS, BRANDING_DEFAULTS } from '@app/schema/utils';

// Cache in-memory in production with a TTL (e.g., 5 minutes)
let cachedHtml: string | null = null;
let lastHtmlFetchTime = 0;
const HTML_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutos

// Database query caching for companies by slug
interface TenantBrandingRow {
    id: number;
    slug: string;
    businessName: string;
    tradeName: string | null;
    logoUrl: string | null;
    primaryColor: string;
    themeColor: string;
    loginBgUrl: string | null;
    isActive: boolean;
}

interface TenantCacheEntry {
    company: TenantBrandingRow | null;
    timestamp: number;
}
const tenantCache = new Map<string, TenantCacheEntry>();
const TENANT_CACHE_TTL_MS = 2 * 60 * 1000; // 2 minutos
const MAX_TENANT_CACHE_SIZE = 500;

export function invalidateTenantCache(slug: string): void {
    tenantCache.delete(slug);
}

/** Shared tenant branding query with in-memory TTL cache. Used by serveSpa, tenant-info, and tenant-manifest. */
export async function getTenantBySlug(slug: string) {
    const now = Date.now();
    const cached = tenantCache.get(slug);
    if (cached && (now - cached.timestamp < TENANT_CACHE_TTL_MS)) {
        return cached.company;
    }

    const [dbCompany] = await adminDb
        .select({
            id: companies.id,
            slug: companies.slug,
            businessName: companies.business_name,
            tradeName: companies.trade_name,
            logoUrl: companies.logo_url,
            primaryColor: companies.primary_color,
            themeColor: companies.theme_color,
            loginBgUrl: companies.login_bg_url,
            isActive: companies.is_active,
        })
        .from(companies)
        .where(eq(companies.slug, slug))
        .limit(1);

    const company = dbCompany || null;

    // FIFO eviction: remove oldest entry if cache exceeds max size
    if (tenantCache.size >= MAX_TENANT_CACHE_SIZE) {
        const oldestKey = tenantCache.keys().next().value;
        if (oldestKey) tenantCache.delete(oldestKey);
    }
    tenantCache.set(slug, { company, timestamp: now });
    return company;
}

// Helper to escape HTML tags and characters
function escapeHtml(str: string): string {
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

// Fetch index.html from frontend server (decoupled, zero disk volume sharing needed)
async function getRawHtml(requestHost?: string): Promise<string> {
    const now = Date.now();
    if (cachedHtml && env.NODE_ENV === 'production' && (now - lastHtmlFetchTime < HTML_CACHE_TTL_MS)) {
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
            lastHtmlFetchTime = now;
        }
        return html;
    } catch (err: any) {
        console.error('❌ Error fetching index.html template from frontend:', err);
        // Serve a minimal emergency fallback HTML with descriptive debug details
        return `<!DOCTYPE html><html><head><title>Zelys - Error de Conexión</title></head><body style="font-family: sans-serif; padding: 2rem; background: #0f172a; color: #f1f5f9;">
            <div style="max-width: 600px; margin: 0 auto; background: #1e293b; padding: 2rem; border-radius: 8px; border: 1px solid #334155;">
                <h1 style="color: #ef4444; margin-top: 0; font-size: 1.5rem;">Error de conexión con el frontend</h1>
                <p>El backend de Elysia no pudo descargar el template <code>index.html</code> original.</p>
                <hr style="border: 0; border-top: 1px solid #334155; margin: 1.5rem 0;" />
                <p><strong>Intentando conectar a:</strong> <code style="background: #0f172a; padding: 0.2rem 0.4rem; border-radius: 4px; color: #38bdf8; font-size: 0.9rem;">${baseUrl}/index.html</code></p>
                <p><strong>Detalle del error:</strong> <code style="color: #fca5a5; font-size: 0.9rem;">${err.message || err}</code></p>
                <p style="font-size: 0.875rem; color: #94a3b8; margin-top: 1.5rem; margin-bottom: 0;">Tip: Verifica si configuraste correctamente la variable <code>FRONTEND_INTERNAL_URL</code> en Coolify (ej: <code>http://&lt;uuid&gt;:80</code>) y que ambos contenedores estén en la misma red de Docker.</p>
            </div>
        </body></html>`;
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
            const company = await getTenantBySlug(slug);

            if (company && company.isActive) {
                // Strict hex color check
                const primCol = isHexColor(company.primaryColor) ? company.primaryColor : BRANDING_DEFAULTS.primaryColor;
                const secCol = isHexColor(company.themeColor) ? company.themeColor : BRANDING_DEFAULTS.themeColor;

                const theme = THEME_PRESETS[secCol] || THEME_PRESETS['#64748b'];
                const onPrimary = getContrastColor(primCol);
                const onSecondary = getContrastColor(secCol);

                let headInjections = '\n<!-- Pre-inyectado por Elysia SPA Renderer -->';

                // 1. CSS Custom Properties for tenant styling
                headInjections += `
<style id="tenant-branding">
  :root {
    --primary: ${primCol};
    --on-primary: ${onPrimary};
    --secondary: ${secCol};
    --on-secondary: ${onSecondary};
    --bg-light-val: ${theme.bgLight};
    --bg-dark-val: ${theme.bgDark};
    --surface-light-val: ${theme.surfaceLight};
    --surface-dark-val: ${theme.surfaceDark};
    --card-light-val: ${theme.cardLight};
    --card-dark-val: ${theme.cardDark};
    --card-alt-light-val: ${theme.cardAltLight};
    --card-alt-dark-val: ${theme.cardAltDark};
    --border-light-val: ${theme.borderLight};
    --border-dark-val: ${theme.borderDark};
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
                    primaryColor: primCol,
                    themeColor: secCol,
                    loginBgUrl: company.loginBgUrl,
                };

                // Escape < and > to prevent XSS script closing injections
                const safeJsonString = JSON.stringify(tenantData)
                    .replace(/</g, '\\u003c')
                    .replace(/>/g, '\\u003e');

                headInjections += `
<script id="tenant-data" type="application/json">
  ${safeJsonString}
</script>
`;

                // 3. Dynamic manifest link (crossorigin API endpoint resolved dynamically)
                const hostWithoutPort = originalHost.split(':')[0];
                let apiDomain = 'localhost:3000';
                let apiProtocol = 'http';
                if (!hostWithoutPort.includes('localhost') && !/^[0-9.]+$/.test(hostWithoutPort)) {
                    apiProtocol = 'https';
                    const parts = hostWithoutPort.split('.');
                    if (parts.length >= 2) {
                        const baseDomain = parts.slice(-2).join('.');
                        apiDomain = `api.${baseDomain}`;
                    }
                }
                const apiUrl = `${apiProtocol}://${apiDomain}`;

                // PWA-01: manifest link is REPLACED (not appended) to avoid duplicates — see below

                // 4. Favicon and shortcut icons (html escaped to prevent attribute breakouts)
                if (company.logoUrl) {
                    const escapedLogoUrl = escapeHtml(company.logoUrl);
                    headInjections += `
<link rel="shortcut icon" href="${escapedLogoUrl}">
<link rel="icon" type="image/png" sizes="192x192" href="${escapedLogoUrl}">
<link rel="apple-touch-icon" href="${escapedLogoUrl}">
`;
                } else {
                    headInjections += `\n<link rel="shortcut icon" href="/favicon.ico">`;
                }

                // Inyectamos estilos, JSON y favicons en el head
                html = html.replace('</head>', `${headInjections}\n</head>`);

                // 5. Replace manifest link (NOT append) to avoid duplicate <link rel="manifest"> — PWA-01
                html = html.replace(
                    /<link rel="manifest"[^>]*>/,
                    `<link rel="manifest" crossorigin="use-credentials" href="${apiUrl}/api/auth/tenant-manifest?slug=${company.slug}" />`
                );

                // 6. Title tag dynamic replacement (escaped to prevent injection)
                const titleText = escapeHtml(`${company.tradeName || company.businessName} - Iniciar Sesión`);
                html = html.replace(/<title>.*?<\/title>/, `<title>${titleText}</title>`);
            } else {
                // Tenant not found or inactive — index.html already has the default manifest link
            }
        } catch (dbError) {
            console.error('❌ Error resolving tenant from database in SPA renderer:', dbError);
            // Fallback gracefully on DB error: serve unbranded index.html (default manifest already present)
        }
    } else {
        // No tenant resolved (landing page or default site) — index.html already has the default manifest link
    }

    set.headers['content-type'] = 'text/html; charset=utf-8';
    return html;
}
