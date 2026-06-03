/**
 * categories.mutations.ts — TanStack Mutation Hooks for Categories module
 *
 * All `createMutation` hooks with optimistic updates.
 * Uses categorieKeys.categoriesFlat() for granular cache targeting.
 */
import { createMutation, useQueryClient } from '@tanstack/solid-query';
import { categoriesApi, type CategoryNode } from './categories.api';
import { categorieKeys } from './categories.keys';
import type { CategoryFormData, CategoryUpdateData } from '@app/schema/frontend';

// =============================================================================
// Create
// =============================================================================

export function useCreateCategory() {
    const qc = useQueryClient();
    return createMutation(() => ({
        mutationKey: ['catalogs', 'categories', 'create'],
        mutationFn: (body: CategoryFormData) => categoriesApi.createCategory(body),
        onSettled: () => {
            qc.invalidateQueries({ queryKey: categorieKeys.categories });
        },
    }));
}

// =============================================================================
// Update
// =============================================================================

export function useUpdateCategory() {
    const qc = useQueryClient();
    return createMutation(() => ({
        mutationKey: ['catalogs', 'categories', 'update'],
        mutationFn: ({ id, data }: { id: number; data: CategoryUpdateData }) => categoriesApi.updateCategory(id, data),
        onSettled: (_d, _e, { id }) => {
            qc.invalidateQueries({ queryKey: categorieKeys.categories });
            qc.invalidateQueries({ queryKey: categorieKeys.categoryDetail(id) });
        },
    }));
}

// =============================================================================
// Reparent (Drag & Drop)
// =============================================================================

export function useReparentCategory() {
    const qc = useQueryClient();
    return createMutation(() => ({
        mutationFn: ({ id, parentId }: { id: number; parentId: number | null }) =>
            categoriesApi.reparent(id, parentId),
        onSettled: () => qc.invalidateQueries({ queryKey: categorieKeys.categories }),
    }));
}

// =============================================================================
// Deactivate (soft delete) — single with optimistic update
// =============================================================================

export function useDeactivateCategory() {
    const qc = useQueryClient();
    return createMutation(() => ({
        mutationFn: (id: number) => categoriesApi.deactivateCategory(id),
        onMutate: async (id: number) => {
            await qc.cancelQueries({ queryKey: categorieKeys.categoriesFlat() });
            const previous = qc.getQueryData<CategoryNode[]>(categorieKeys.categoriesFlat());
            qc.setQueryData<CategoryNode[]>(categorieKeys.categoriesFlat(), (old) =>
                (old as any)?.map((item: any) => item.id === id ? { ...item, is_active: false } : item)
            );
            return { previous };
        },
        onError: (_err: unknown, _id: number, context: { previous?: CategoryNode[] } | undefined) => {
            if (context?.previous) qc.setQueryData(categorieKeys.categoriesFlat(), context.previous);
        },
        onSettled: () => qc.invalidateQueries({ queryKey: categorieKeys.categories }),
    }));
}

// =============================================================================
// Restore — single with optimistic update
// =============================================================================

export function useRestoreCategory() {
    const qc = useQueryClient();
    return createMutation(() => ({
        mutationFn: (id: number) => categoriesApi.restoreCategory(id),
        onMutate: async (id: number) => {
            await qc.cancelQueries({ queryKey: categorieKeys.categoriesFlat() });
            const previous = qc.getQueryData<CategoryNode[]>(categorieKeys.categoriesFlat());
            qc.setQueryData<CategoryNode[]>(categorieKeys.categoriesFlat(), (old) =>
                (old as any)?.map((item: any) => item.id === id ? { ...item, is_active: true } : item)
            );
            return { previous };
        },
        onError: (_err: unknown, _id: number, context: { previous?: CategoryNode[] } | undefined) => {
            if (context?.previous) qc.setQueryData(categorieKeys.categoriesFlat(), context.previous);
        },
        onSettled: () => qc.invalidateQueries({ queryKey: categorieKeys.categories }),
    }));
}

// =============================================================================
// Hard Delete — permanent
// =============================================================================

export function useHardDeleteCategory() {
    const qc = useQueryClient();
    return createMutation(() => ({
        mutationFn: (id: number) => categoriesApi.hardDelete(id),
        onMutate: async (id: number) => {
            await qc.cancelQueries({ queryKey: categorieKeys.categoriesFlat() });
            const previous = qc.getQueryData<CategoryNode[]>(categorieKeys.categoriesFlat());
            qc.setQueryData<CategoryNode[]>(categorieKeys.categoriesFlat(), (old) =>
                (old as any)?.filter((item: any) => item.id !== id)
            );
            return { previous };
        },
        onError: (_err: unknown, _id: number, context: { previous?: CategoryNode[] } | undefined) => {
            if (context?.previous) qc.setQueryData(categorieKeys.categoriesFlat(), context.previous);
        },
        onSettled: () => qc.invalidateQueries({ queryKey: categorieKeys.categories }),
    }));
}

// =============================================================================
// Bulk Deactivate
// =============================================================================

export function useBulkDeactivateCategories() {
    const qc = useQueryClient();
    return createMutation(() => ({
        mutationFn: (ids: number[]) => categoriesApi.bulkDeactivate(ids),
        onMutate: async (ids: number[]) => {
            await qc.cancelQueries({ queryKey: categorieKeys.categoriesFlat() });
            const previous = qc.getQueryData<CategoryNode[]>(categorieKeys.categoriesFlat());
            qc.setQueryData<CategoryNode[]>(categorieKeys.categoriesFlat(), (old) =>
                (old as any)?.map((item: any) => ids.includes(item.id) ? { ...item, is_active: false } : item)
            );
            return { previous };
        },
        onError: (_err: unknown, _ids: number[], context: { previous?: CategoryNode[] } | undefined) => {
            if (context?.previous) qc.setQueryData(categorieKeys.categoriesFlat(), context.previous);
        },
        onSettled: () => qc.invalidateQueries({ queryKey: categorieKeys.categories }),
    }));
}

// =============================================================================
// Bulk Restore
// =============================================================================

export function useBulkRestoreCategories() {
    const qc = useQueryClient();
    return createMutation(() => ({
        mutationFn: (ids: number[]) => categoriesApi.bulkRestore(ids),
        onMutate: async (ids: number[]) => {
            await qc.cancelQueries({ queryKey: categorieKeys.categoriesFlat() });
            const previous = qc.getQueryData<CategoryNode[]>(categorieKeys.categoriesFlat());
            qc.setQueryData<CategoryNode[]>(categorieKeys.categoriesFlat(), (old) =>
                (old as any)?.map((item: any) => ids.includes(item.id) ? { ...item, is_active: true } : item)
            );
            return { previous };
        },
        onError: (_err: unknown, _ids: number[], context: { previous?: CategoryNode[] } | undefined) => {
            if (context?.previous) qc.setQueryData(categorieKeys.categoriesFlat(), context.previous);
        },
        onSettled: () => qc.invalidateQueries({ queryKey: categorieKeys.categories }),
    }));
}

// =============================================================================
// Reorder
// =============================================================================

export function useReorderCategories() {
    const qc = useQueryClient();
    return createMutation(() => ({
        mutationFn: (items: Array<{ id: number; sort_order: number }>) => categoriesApi.reorderCategories(items),
        onSettled: () => {
            qc.invalidateQueries({ queryKey: categorieKeys.categories });
        },
    }));
}
