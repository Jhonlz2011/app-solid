/**
 * organizations.queries.ts — TanStack Query Hooks for User Organizations
 */
import { createQuery } from '@tanstack/solid-query';
import { STALE_TIME, GC_TIME } from '@shared/constants/cache.constants';
import { fetchUserOrganizations, type BetterAuthOrg } from '../utils/resolve-routing';

export interface UserOrganizationItem {
    id: string;
    name: string;
    slug: string;
    logo?: string | null;
}

export const organizationKeys = {
    all: ['user-organizations'] as const,
};

export function useUserOrganizations() {
    return createQuery(() => ({
        queryKey: organizationKeys.all,
        queryFn: async (): Promise<UserOrganizationItem[]> => {
            const orgs = await fetchUserOrganizations();
            return (orgs || []).map((org: BetterAuthOrg) => ({
                id: org.id,
                name: org.name,
                slug: org.slug || '',
                logo: org.logo || null,
            }));
        },
        staleTime: STALE_TIME.MEDIUM, // 5 minutes
        gcTime: GC_TIME.DEFAULT,       // 30 minutes
    }));
}
