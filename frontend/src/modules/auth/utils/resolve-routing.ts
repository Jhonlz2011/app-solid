import { authClient } from '@shared/lib/auth-client';
import type { DiscoverTenantItemType } from '@app/schema/dto';

// ============================================================================
// Organization → Tenant Mapper (M-01: single typed implementation)
// ============================================================================

interface BetterAuthOrg {
    id: string;
    name: string;
    slug: string | null;
    logo?: string | null;
}

/**
 * Maps a Better Auth organization to the DiscoverTenantItemType used by the UI.
 * Single source of truth — replaces 5 duplicated `(o: any) => ({ ... })` blocks.
 */
export function mapOrgToTenant(org: BetterAuthOrg): DiscoverTenantItemType {
    return {
        organizationId: org.id,
        slug: org.slug || '',
        businessName: org.name,
        tradeName: org.name,
        logoUrl: org.logo || null,
    };
}

// ============================================================================
// Fetch Organizations (H-06: centralized, deduplicated)
// ============================================================================

let cachedOrgs: BetterAuthOrg[] | null = null;
let cacheTimestamp = 0;
let fetchPromise: Promise<BetterAuthOrg[]> | null = null;
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Fetches user organizations from Better Auth with in-memory caching
 * AND in-flight request deduplication.
 *
 * Multiple concurrent callers (auth.routes.tsx, router.tsx, SidebarHeader)
 * share the same HTTP request instead of firing N separate ones.
 *
 * @param forceRefresh - Bypass cache and re-fetch from server
 */
export async function fetchUserOrganizations(forceRefresh = false): Promise<BetterAuthOrg[]> {
    const now = Date.now();

    // Return from cache if valid and not forced
    if (!forceRefresh && cachedOrgs && (now - cacheTimestamp) < CACHE_TTL_MS) {
        return cachedOrgs;
    }

    // In-flight dedup: if a request is already in progress, piggyback on it
    if (fetchPromise && !forceRefresh) {
        return fetchPromise;
    }

    fetchPromise = (async () => {
        try {
            const res = await authClient.organization.list();
            cachedOrgs = (res?.data || []) as BetterAuthOrg[];
            cacheTimestamp = Date.now();
            return cachedOrgs;
        } catch (err) {
            console.error('[Auth] Failed to fetch organizations:', err);
            return cachedOrgs || [];
        } finally {
            fetchPromise = null;
        }
    })();

    return fetchPromise;
}

/**
 * Invalidate the cached org list (e.g. after creating a new org or switching).
 */
export function invalidateOrgCache(): void {
    cachedOrgs = null;
    cacheTimestamp = 0;
}

// ============================================================================
// Post-Auth Routing Decision (H-05: single implementation)
// ============================================================================

export type RoutingDecision =
    | { action: 'show-selector'; tenants: DiscoverTenantItemType[] }
    | { action: 'redirect-tenant'; slug: string; path: string }
    | { action: 'onboard' }
    | { action: 'stay'; organizationId?: string }
    | { action: 'no-access'; currentSlug: string; tenants: DiscoverTenantItemType[] };

/**
 * Determines what should happen after a user is authenticated.
 * Single source of truth for post-auth routing — replaces 3 duplicated
 * `handleAuthenticatedRouting` / `enforceTenantHost` implementations.
 *
 * Rules:
 * - On a tenant subdomain (acme.zelys.app): ONLY allow access if user belongs to that tenant.
 *   Never show the org selector — either grant access or deny with 'no-access'.
 * - On the global portal (in.zelys.app, localhost): Show selector if >1 org, fast-path if 1 org.
 *
 * @param user - The authenticated user profile (from getMe or auth store)
 * @param isGlobalPortal - Whether the current host is the global portal (in.zelys.app, localhost, etc.)
 * @param currentSlug - The current subdomain slug (null if global portal)
 * @param targetPath - Where the user intended to go (default: /dashboard)
 */
export async function resolvePostAuthRouting(
    user: { companySlug?: string | null; companyId?: number | null } | null,
    isGlobalPortal: boolean,
    currentSlug: string | null,
    targetPath = '/dashboard',
): Promise<RoutingDecision> {
    // Special path: creating a new company is allowed for any authenticated user
    if (targetPath === '/create-company' || targetPath.startsWith('/create-company')) {
        return { action: 'stay' };
    }

    const orgs = await fetchUserOrganizations();

    // Case 0: No organizations → onboarding required
    if (orgs.length === 0 && (!user?.companySlug && (!user?.companyId || user.companyId === 0))) {
        return { action: 'onboard' };
    }

    // ══════════════════════════════════════════════════════════════════════
    // TENANT SUBDOMAIN (e.g. acme.zelys.app) — strict membership enforcement
    // ══════════════════════════════════════════════════════════════════════
    if (!isGlobalPortal && currentSlug) {
        const matchingOrg = orgs.find(o => o.slug === currentSlug);
        if (matchingOrg) {
            // User belongs to this tenant — stay; only switch if active org is not already this tenant
            const needsSwitch = user?.companySlug !== currentSlug;
            return {
                action: 'stay',
                organizationId: needsSwitch ? matchingOrg.id : undefined,
            };
        }

        // Case: User belongs to exactly 1 other tenant → seamless canonical auto-redirect
        if (orgs.length === 1 && orgs[0].slug) {
            return { action: 'redirect-tenant', slug: orgs[0].slug, path: targetPath };
        }

        // Case: User belongs to >1 other tenants (none matches current subdomain) → show denial & selector
        if (orgs.length > 1) {
            return {
                action: 'no-access',
                currentSlug,
                tenants: orgs.map(mapOrgToTenant),
            };
        }

        // Case: User has no organizations → onboarding
        return { action: 'onboard' };
    }

    // ══════════════════════════════════════════════════════════════════════
    // GLOBAL PORTAL (in.zelys.app, localhost) — show selector or fast-path
    // ══════════════════════════════════════════════════════════════════════

    // Case 2: Multiple orgs → show selector
    if (isGlobalPortal && orgs.length > 1) {
        return { action: 'show-selector', tenants: orgs.map(mapOrgToTenant) };
    }

    // Case 3: Exactly 1 org → fast-path redirect
    if (isGlobalPortal && orgs.length === 1 && orgs[0].slug) {
        return { action: 'redirect-tenant', slug: orgs[0].slug, path: targetPath };
    }

    // Case 4: Global portal with user.companySlug fallback
    if (isGlobalPortal && user?.companySlug) {
        return { action: 'redirect-tenant', slug: user.companySlug, path: targetPath };
    }

    // Default: stay on current page
    return { action: 'stay' };
}
