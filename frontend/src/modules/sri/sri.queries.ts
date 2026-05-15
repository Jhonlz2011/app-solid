import { createQuery, keepPreviousData } from "@tanstack/solid-query";
import type { SriSupplierResponse } from "./sri.types";
import { api } from '@shared/lib/eden';


/**
 * Hook to search the SRI database by RUC.
 */
export function useSriSearchByRuc(querySignal: () => string) {
    return createQuery(() => ({
        queryKey: ['sri', 'by-ruc', querySignal()],
        queryFn: async (): Promise<SriSupplierResponse[]> => {
            const query = querySignal();
            if (query.length !== 13) return [];
            
            const { data, error } = await api.api.sri['by-ruc'].get({
                query: { q: query }
            });
            
            if (error) throw new Error(String(error.value));
            return data as SriSupplierResponse[];
        },
        enabled: querySignal().length === 13,
        staleTime: 1000 * 60 * 60 * 24, // 24 hours
        gcTime: 1000 * 60 * 60 * 24 * 7, // 7 days in cache
        retry: 1,
    }));
}

/**
 * Hook to search the SRI database by business name or trade name.
 */
export function useSriSearchByName(querySignal: () => string) {
    return createQuery(() => ({
        queryKey: ['sri', 'by-name', querySignal()],
        queryFn: async (): Promise<SriSupplierResponse[]> => {
            const query = querySignal();
            if (query.length < 3) return [];
            
            const { data, error } = await api.api.sri['by-name'].get({
                query: { q: query }
            });
            
            if (error) throw new Error(String(error.value));
            return data as SriSupplierResponse[];
        },
        enabled: querySignal().length >= 3,
        staleTime: 1000 * 60 * 60 * 24, // 24 hours
        gcTime: 1000 * 60 * 60 * 24 * 7, // 7 days in cache
        retry: 1,
        placeholderData: keepPreviousData,
    }));
}