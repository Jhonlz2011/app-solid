import { createQuery, keepPreviousData } from '@tanstack/solid-query';
import type { SriSearchResult } from './sri.types';
import { api } from '@shared/lib/eden';
import { STALE_TIME, GC_TIME } from '@shared/constants/cache.constants';

/**
 * Canonical query keys for SRI searches — single source of truth across app.
 */
export const sriKeys = {
    all: ['sri'] as const,
    byRuc: (ruc: string) => [...sriKeys.all, 'by-ruc', ruc] as const,
    byName: (name: string) => [...sriKeys.all, 'by-name', name] as const,
};

/**
 * Imperative fetcher for SRI by RUC (used in forms with queryClient.fetchQuery).
 */
export async function fetchSriByRuc(ruc: string): Promise<SriSearchResult[]> {
    if (ruc.length !== 13) return [];
    const { data, error } = await api.sri['by-ruc'].get({
        query: { q: ruc },
    });
    if (error) throw new Error(String(error.value));
    return (data || []) as SriSearchResult[];
}

/**
 * Imperative fetcher for SRI by Name.
 */
export async function fetchSriByName(name: string): Promise<SriSearchResult[]> {
    if (name.length < 3) return [];
    const { data, error } = await api.sri['by-name'].get({
        query: { q: name },
    });
    if (error) throw new Error(String(error.value));
    return (data || []) as SriSearchResult[];
}

/**
 * Hook to search the SRI database by RUC.
 */
export function useSriSearchByRuc(querySignal: () => string) {
    return createQuery(() => ({
        queryKey: sriKeys.byRuc(querySignal()),
        queryFn: () => fetchSriByRuc(querySignal()),
        enabled: querySignal().length === 13,
        staleTime: STALE_TIME.DAY,
        gcTime: GC_TIME.WEEK,
        retry: 1,
    }));
}

/**
 * Hook to search the SRI database by business name or trade name.
 */
export function useSriSearchByName(querySignal: () => string) {
    return createQuery(() => ({
        queryKey: sriKeys.byName(querySignal()),
        queryFn: () => fetchSriByName(querySignal()),
        enabled: querySignal().length >= 3,
        staleTime: STALE_TIME.DAY,
        gcTime: GC_TIME.WEEK,
        retry: 1,
        placeholderData: keepPreviousData,
    }));
}