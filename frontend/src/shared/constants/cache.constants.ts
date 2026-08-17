/**
 * Centralized cache timing constants for TanStack Query.
 * Eliminates magic numbers across all query/mutation files.
 */
export const STALE_TIME = {
    /** 2 minutes — List data, table pages */
    SHORT: 2 * 60_000,
    /** 5 minutes — Detail views, facets */
    MEDIUM: 5 * 60_000,
    /** 30 minutes — Catalogs, departments */
    LONG: 30 * 60_000,
    /** 24 hours — SRI lookups, reference data */
    DAY: 24 * 60 * 60_000,
} as const;

export const GC_TIME = {
    /** 30 seconds — Preflight delete checks */
    PREFLIGHT: 30_000,
    /** 30 minutes — Standard garbage collection */
    DEFAULT: 30 * 60_000,
    /** 7 days — Long-lived SRI cache */
    WEEK: 7 * 24 * 60 * 60_000,
} as const;
