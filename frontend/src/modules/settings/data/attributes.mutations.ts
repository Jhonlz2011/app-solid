import { createMutation, useQueryClient } from '@tanstack/solid-query';
import { attributesApi } from './attributes.api';
import { attributeKeys } from './attributes.keys';
import type { AttributeFormData } from '@app/schema/frontend';

// =============================================================================
// Mutation Hooks — Attributes
// =============================================================================

export function useCreateAttribute() {
    const qc = useQueryClient();
    return createMutation(() => ({
        mutationFn: (body: AttributeFormData) => attributesApi.createAttribute(body),
        onSettled: () => {
            qc.invalidateQueries({ queryKey: attributeKeys.attributes });
        },
    }));
}

export function useUpdateAttribute() {
    const qc = useQueryClient();
    return createMutation(() => ({
        mutationFn: ({ id, data }: { id: number; data: AttributeFormData }) => attributesApi.updateAttribute(id, data),
        onSettled: (_d, _e, { id }) => {
            qc.invalidateQueries({ queryKey: attributeKeys.attributes });
            qc.invalidateQueries({ queryKey: attributeKeys.attributeDetail(id) });
        },
    }));
}

export function useDeactivateAttribute() {
    const qc = useQueryClient();
    return createMutation(() => ({
        mutationFn: (id: number) => attributesApi.deactivateAttribute(id),
        onSettled: () => {
            qc.invalidateQueries({ queryKey: attributeKeys.attributes });
        },
    }));
}

export function useRestoreAttribute() {
    const qc = useQueryClient();
    return createMutation(() => ({
        mutationFn: (id: number) => attributesApi.restoreAttribute(id),
        onSettled: () => {
            qc.invalidateQueries({ queryKey: attributeKeys.attributes });
        },
    }));
}
