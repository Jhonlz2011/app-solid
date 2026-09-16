import type {
    TaxonomyCategoryResponseType,
    TaxonomyAttributeResponseType,
    TaxonomyEnsureCategoryResponseType,
} from '@app/schema/backend';

export type {
    TaxonomyCategoryResponseType,
    TaxonomyAttributeResponseType,
    TaxonomyEnsureCategoryResponseType,
};

import { createQuery } from '@tanstack/solid-query';
import { api } from '@shared/lib/eden';
import { throwApiError } from '@shared/utils/api-errors';
import { STALE_TIME, GC_TIME } from '@shared/constants/cache.constants';




export const taxonomyKeys = {
    all: ['references', 'taxonomy'] as const,
    categories: (q: string) => [...taxonomyKeys.all, 'categories', q] as const,
    categoryAttributes: (categoryId: number) => [...taxonomyKeys.all, 'category-attributes', categoryId] as const,
};

/**
 * Búsqueda reactiva de categorías en la taxonomía estándar global (14.606 categorías)
 */
export async function fetchTaxonomyCategories(q: string, limit = 20): Promise<TaxonomyCategoryResponseType[]> {
    const clean = q.trim();
    if (!clean) return [];

    const { data, error } = await api.references.taxonomy.categories.get({
        query: { q: clean, limit },
    });

    if (error) throwApiError(error);
    return (data || []) as TaxonomyCategoryResponseType[];
}

/**
 * Obtiene los metacampos recomendados y sus valores canónicos (con muestras de color) para una categoría
 */
export async function fetchTaxonomyCategoryAttributes(categoryId: number): Promise<TaxonomyAttributeResponseType[]> {
    if (!categoryId || categoryId <= 0) return [];

    const { data, error } = await api.references.taxonomy.categories({ id: categoryId }).attributes.get();

    if (error) throwApiError(error);
    return (data || []) as TaxonomyAttributeResponseType[];
}

/**
 * Asegura/sincroniza que una categoría estándar exista en la tabla local del tenant para satisfacer FK
 */
export async function ensureTenantCategory(taxonomyCategoryId: number): Promise<TaxonomyEnsureCategoryResponseType> {
    const { data, error } = await api.references.taxonomy.categories({ id: taxonomyCategoryId }).ensure.post();

    if (error) throwApiError(error);
    return data as TaxonomyEnsureCategoryResponseType;
}

/**
 * Hook de TanStack Query para buscar categorías estándar de la taxonomía
 */
export function useTaxonomyCategories(querySignal: () => string) {
    return createQuery(() => ({
        queryKey: taxonomyKeys.categories(querySignal()),
        queryFn: () => fetchTaxonomyCategories(querySignal()),
        enabled: querySignal().trim().length >= 1,
        staleTime: STALE_TIME.LONG,
        gcTime: GC_TIME.WEEK,
    }));
}

/**
 * Hook de TanStack Query para cargar atributos recomendados de una categoría estándar
 */
export function useTaxonomyCategoryAttributes(categoryIdSignal: () => number | null | undefined) {
    return createQuery(() => ({
        queryKey: taxonomyKeys.categoryAttributes(categoryIdSignal() ?? 0),
        queryFn: () => fetchTaxonomyCategoryAttributes(categoryIdSignal()!),
        enabled: (categoryIdSignal() ?? 0) > 0,
        staleTime: STALE_TIME.LONG,
        gcTime: GC_TIME.WEEK,
    }));
}
