import { createQuery } from '@tanstack/solid-query';
import { categoriesApi, type CategoryNode, type CategoryDetail, type CategoryReferences } from './categories.api';
import { categorieKeys } from './categories.keys';
import type { Accessor } from 'solid-js';

export function useCategoriesTree() {
    return createQuery(() => ({
        queryKey: categorieKeys.categoriesTree(),
        queryFn: () => categoriesApi.listCategories(false) as Promise<CategoryNode[]>,
        staleTime: 1000 * 60 * 10,
        gcTime: 1000 * 60 * 60,
    }));
}

export function useCategoriesFlat() {
    return createQuery(() => ({
        queryKey: categorieKeys.categoriesFlat(),
        queryFn: () => categoriesApi.listCategories(true),
        staleTime: 1000 * 60 * 10,
        gcTime: 1000 * 60 * 60,
    }));
}

export function useCategoryDetail(id: () => number | null) {
    return createQuery(() => ({
        queryKey: categorieKeys.categoryDetail(id()!),
        queryFn: () => categoriesApi.getCategory(id()!) as Promise<CategoryDetail>,
        enabled: id() !== null && id()! > 0,
        staleTime: 1000 * 60 * 5,
    }));
}

export function useCategoryFormSchema(id: () => number | null) {
    return createQuery(() => ({
        queryKey: categorieKeys.categoryFormSchema(id()!),
        queryFn: () => categoriesApi.getCategoryFormSchema(id()!),
        enabled: id() !== null && id()! > 0,
        staleTime: 1000 * 60 * 10,
    }));
}

export function useCheckCategoryReferences(id: Accessor<number | null>, enabled: Accessor<boolean>) {
    return createQuery(() => ({
        queryKey: categorieKeys.references(id()!),
        queryFn: () => categoriesApi.checkReferences(id()!),
        enabled: enabled() && id() !== null,
        staleTime: 0,
        retry: false,
    }));
}
