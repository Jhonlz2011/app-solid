import { createQuery } from '@tanstack/solid-query';
import { STALE_TIME, GC_TIME } from '@shared/constants/cache.constants';
import { categoriesApi } from './categories.api';
import { categoryKeys } from './categories.keys';

export function useCategoriesTree() {
    return createQuery(() => ({
        queryKey: categoryKeys.categoriesTree(),
        queryFn: () => categoriesApi.listCategories(false),
        staleTime: STALE_TIME.LONG,
        gcTime: GC_TIME.DEFAULT,
    }));
}

export function useCategoriesFlat() {
    return createQuery(() => ({
        queryKey: categoryKeys.categoriesFlat(),
        queryFn: () => categoriesApi.listCategories(true),
        staleTime: STALE_TIME.LONG,
        gcTime: GC_TIME.DEFAULT,
    }));
}

export function useCategoryDetail(id: () => number | null | undefined) {
    return createQuery(() => ({
        queryKey: categoryKeys.categoryDetail(id() ?? 0),
        queryFn: () => categoriesApi.getCategory(id()!),
        enabled: Boolean(id() && id()! > 0),
        staleTime: STALE_TIME.MEDIUM,
        gcTime: GC_TIME.DEFAULT,
    }));
}

export function useCategoryFormSchema(id: () => number | null | undefined) {
    return createQuery(() => ({
        queryKey: categoryKeys.categoryFormSchema(id() ?? 0),
        queryFn: () => categoriesApi.getCategoryFormSchema(id()!),
        enabled: Boolean(id() && id()! > 0),
        staleTime: STALE_TIME.LONG,
        gcTime: GC_TIME.DEFAULT,
    }));
}

export function useCheckCategoryReferences(id: () => number | null | undefined, enabled: () => boolean) {
    return createQuery(() => ({
        queryKey: categoryKeys.references(id() ?? 0),
        queryFn: () => categoriesApi.checkReferences(id()!),
        enabled: enabled() && Boolean(id()),
        staleTime: 0,
        gcTime: GC_TIME.PREFLIGHT,
        retry: false,
    }));
}
