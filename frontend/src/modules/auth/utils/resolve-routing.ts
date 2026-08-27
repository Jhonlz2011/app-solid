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
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Fetches user organizations from Better Auth with in-memory caching.
 * Avoids redundant HTTP calls across auth.routes.tsx, Login.tsx, router.tsx, SidebarHeader.
 *
 * @param forceRefresh - Bypass cache and re-fetch from server
 */
export async function fetchUserOrganizations(forceRefresh = false): Promise<BetterAuthOrg[]> {
    const now = Date.now();

    if (!forceRefresh && cachedOrgs && (now - cacheTimestamp) < CACHE_TTL_MS) {
        return cachedOrgs;
    }

    try {
        const res = await authClient.organization.list();
        cachedOrgs = (res?.data || []) as BetterAuthOrg[];
        cacheTimestamp = now;
        return cachedOrgs;
    } catch (err) {
        console.error('[Auth] Failed to fetch organizations:', err);
        return cachedOrgs || [];
    }
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
    | { action: 'stay' };

/**
 * Determines what should happen after a user is authenticated.
 * Single source of truth for post-auth routing — replaces 3 duplicated
 * `handleAuthenticatedRouting` / `enforceTenantHost` implementations.
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
    const orgs = await fetchUserOrganizations();

    // Case 0: No organizations → onboarding required
    if (orgs.length === 0 && (!user?.companySlug && (!user?.companyId || user.companyId === 0))) {
        return { action: 'onboard' };
    }

    // Case 1: On a specific tenant subdomain (e.g. acme.zelys.app)
    if (!isGlobalPortal && currentSlug) {
        const matchingOrg = orgs.find(o => o.slug === currentSlug);
        if (matchingOrg) {
            // User belongs to this tenant — stay
            return { action: 'stay' };
        }
        // User doesn't belong here — show selector with all their orgs
        if (orgs.length > 0) {
            return { action: 'show-selector', tenants: orgs.map(mapOrgToTenant) };
        }
    }

    // Case 2: Global portal with multiple orgs → show selector
    if (isGlobalPortal && orgs.length > 1) {
        return { action: 'show-selector', tenants: orgs.map(mapOrgToTenant) };
    }

    // Case 3: Global portal with exactly 1 org → fast-path redirect
    if (isGlobalPortal && orgs.length === 1 && orgs[0].slug) {
        return { action: 'redirect-tenant', slug: orgs[0].slug, path: targetPath };
    }

    // Case 4: Global portal with user.companySlug fallback
    if (isGlobalPortal && user?.companySlug) {
        return { action: 'redirect-tenant', slug: user.companySlug, path: targetPath };
    }

    // Default: stay on current page (render dashboard or whatever child route)
    return { action: 'stay' };
}
