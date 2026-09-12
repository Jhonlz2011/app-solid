import { adminDb } from '../db';
import { companies } from '@app/schema/tables';
import { eq } from '@app/schema';
import type { TenantBrandingType } from '@app/schema/backend';
import { env } from '../../config/env';
import { resolveSlugFromHost, getContrastColor, isHexColor, THEME_PRESETS, BRANDING_DEFAULTS } from '@app/schema/utils';
import { getTenantRouteMetadata } from '../../modules/settings/menu.service';

// Cache in-memory in production with a TTL (e.g., 5 minutes)
let cachedHtml: string | null = null;
let lastHtmlFetchTime = 0;
const HTML_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutos

// Database query caching for companies by slug
interface TenantBrandingRow {
    id: number;
    slug: string;
    organizationId?: string | null;
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
            organizationId: companies.organization_id,
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

// Fetch index.html from frontend server (internal Docker network: http://frontend:80)
async function getRawHtml(): Promise<string> {
    const now = Date.now();
    if (cachedHtml && env.NODE_ENV === 'production' && (now - lastHtmlFetchTime < HTML_CACHE_TTL_MS)) {
        return cachedHtml;
    }

    const baseUrl = env.FRONTEND_INTERNAL_URL;

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
}

// Helper: inject app-config JSON (deduplicated — was repeated 3x)
function injectAppConfig(html: string, apiUrl: string, sseUrl: string): string {
    const json = JSON.stringify({ apiUrl, sseUrl })
        .replace(/</g, '\\u003c').replace(/>/g, '\\u003e');
    return html.replace('</head>', `\n<script id="app-config" type="application/json">\n  ${json}\n</script>\n</head>`);
}

// Wildcard Elysia route handler for serving the branded SPA index.html
export async function serveSpa({ request, query, set }: { request: Request; query: Record<string, string | undefined>; set: any }) {
    const url = new URL(request.url);

    // Safety check: Never serve SPA for broken /api/ endpoints
    if (url.pathname.startsWith('/api/')) {
        set.status = 404;
        return { error: 'Not Found', details: 'Endpoint not registered under /api' };
    }

    const originalHost = request.headers.get('x-original-host') || request.headers.get('x-forwarded-host') || request.headers.get('host') || '';
    const slug = resolveSlugFromHost(originalHost, query.slug);

    let html: string;
    try {
        html = await getRawHtml();
    } catch (fetchErr: any) {
        console.error('❌ Failed to fetch index.html template from frontend container:', fetchErr?.message || fetchErr);
        // Si el frontend no responde, devolvemos 502 para que Caddy active su handle_response y sirva el index.html local
        set.status = 502;
        return '502 Bad Gateway - Frontend template unavailable';
    }

    // Resolve API URL dynamically from env (no hardcoding)
    const apiUrl = env.API_PUBLIC_URL || `https://api.zelys.app`;
    const sseUrl = `${apiUrl}/api/sse`;

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
                const tenantData: TenantBrandingType = {
                    id: company.id,
                    slug: company.slug,
                    businessName: company.businessName,
                    tradeName: company.tradeName || company.businessName,
                    logoUrl: company.logoUrl,
                    primaryColor: primCol,
                    themeColor: secCol,
                    loginBgUrl: company.loginBgUrl,
                    apiUrl,
                    sseUrl,
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
                // PWA-01: manifest link is REPLACED (not appended) to avoid duplicates — see below

                // 4. Favicon and shortcut icons (html escaped to prevent attribute breakouts)
                if (company.logoUrl) {
                    const escapedLogoUrl = escapeHtml(company.logoUrl);
                    headInjections += `
<link rel="shortcut icon" href="${escapedLogoUrl}">
<link rel="icon" type="image/webp" sizes="192x192" href="${escapedLogoUrl}">
<link rel="apple-touch-icon" href="${escapedLogoUrl}">
`;
                } else {
                    headInjections += `\n<link rel="shortcut icon" href="/favicon.ico">`;
                }

                // 7. Route Metadata (Aliases & Dynamic Labels) — Pre-boot script for 0ms mitigation
                try {
                    const { aliases, labels } = await getTenantRouteMetadata(company.id);
                    if (Object.keys(aliases).length > 0) {
                        const safeAliasJson = JSON.stringify(aliases)
                            .replace(/</g, '\\u003c').replace(/>/g, '\\u003e');

                        headInjections += `
<script id="route-aliases" type="application/json">${safeAliasJson}</script>
`;
                    }
                    if (Object.keys(labels).length > 0) {
                        const safeLabelsJson = JSON.stringify(labels)
                            .replace(/</g, '\\u003c').replace(/>/g, '\\u003e');

                        headInjections += `
<script id="route-labels" type="application/json">${safeLabelsJson}</script>
`;
                    }
                } catch (metaErr) {
                    // Non-critical: if metadata fails, the app works normally without masking
                    console.error('⚠️ Route metadata injection skipped:', metaErr);
                }

                // Remove existing static favicon tags to avoid duplicates
                html = html.replace(/<link[^>]+rel=["']?(?:shortcut icon|icon|apple-touch-icon)["']?[^>]*>/gi, '');

                // Inyectamos estilos, JSON y favicons en el head
                html = html.replace('</head>', `${headInjections}\n</head>`);

                // 5. Replace manifest link (NOT append) to avoid duplicate <link rel="manifest"> — PWA-01
                html = html.replace(
                    /<link rel="manifest"[^>]*>/,
                    `<link rel="manifest" crossorigin="use-credentials" href="${apiUrl}/api/tenants/tenant-manifest?slug=${company.slug}" />`
                );

                // 6. Title tag dynamic replacement (escaped to prevent injection)
                const titleText = escapeHtml(`${company.tradeName || company.businessName}`);
                html = html.replace(/<title>.*?<\/title>/, `<title>${titleText}</title>`);
            } else {
                // Tenant not found or inactive
                html = injectAppConfig(html, apiUrl, sseUrl);
            }
        } catch (dbError) {
            console.error('❌ Error resolving tenant from database in SPA renderer:', dbError);
            html = injectAppConfig(html, apiUrl, sseUrl);
        }
    } else {
        // No tenant resolved (landing page or default site)
        html = injectAppConfig(html, apiUrl, sseUrl);
    }

    set.headers['content-type'] = 'text/html; charset=utf-8';
    set.headers['cache-control'] = 'no-cache, no-store, must-revalidate';
    return html;
}
