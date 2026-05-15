import { createMutation, useQueryClient } from '@tanstack/solid-query';
import { categoriesApi } from './categories.api';
import { categorieKeys } from './categories.keys';
import type { CategoryFormData, CategoryUpdateData } from '@app/schema/frontend';

// =============================================================================
// Mutation Hooks — Categories
// =============================================================================

export function useCreateCategory() {
    const qc = useQueryClient();
    return createMutation(() => ({
        mutationFn: (body: CategoryFormData) => categoriesApi.createCategory(body),
        onSettled: () => {
            qc.invalidateQueries({ queryKey: categorieKeys.categories });
        },
    }));
}

export function useUpdateCategory() {
    const qc = useQueryClient();
    return createMutation(() => ({
        mutationFn: ({ id, data }: { id: number; data: CategoryUpdateData }) => categoriesApi.updateCategory(id, data),
        onSettled: (_d, _e, { id }) => {
            qc.invalidateQueries({ queryKey: categorieKeys.categories });
            qc.invalidateQueries({ queryKey: categorieKeys.categoryDetail(id) });
        },
    }));
}

export function useDeactivateCategory() {
    const qc = useQueryClient();
    return createMutation(() => ({
        mutationFn: (id: number) => categoriesApi.deactivateCategory(id),
        onSettled: () => {
            qc.invalidateQueries({ queryKey: categorieKeys.categories });
        },
    }));
}

export function useRestoreCategory() {
    const qc = useQueryClient();
    return createMutation(() => ({
        mutationFn: (id: number) => categoriesApi.restoreCategory(id),
        onSettled: () => {
            qc.invalidateQueries({ queryKey: categorieKeys.categories });
        },
    }));
}

export function useReorderCategories() {
    const qc = useQueryClient();
    return createMutation(() => ({
        mutationFn: (items: Array<{ id: number; sort_order: number }>) => categoriesApi.reorderCategories(items),
        onSettled: () => {
            qc.invalidateQueries({ queryKey: categorieKeys.categories });
        },
    }));
}
