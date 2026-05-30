import { Component, createSignal } from 'solid-js';
import { useAuth } from '@/modules/auth/store/auth.store';
import { useCheckCategoryReferences } from '../data/categories.queries';
import { useDeactivateCategory, useHardDeleteCategory } from '../data/categories.mutations';
import { CategoryNode } from '../data/categories.api';
import DeleteDialog from '@shared/ui/DeleteDialog';
import { toast } from 'solid-sonner';

export interface CategoryDeleteDialogProps {
    category: CategoryNode | null;
    onClose: () => void;
    onSuccess?: () => void;
}

const CategoryDeleteDialog: Component<CategoryDeleteDialogProps> = (props) => {
    const auth = useAuth();
    const canDestroy = () => auth.hasPermission('categories.destroy');

    const [mode, setMode] = createSignal<'soft' | 'hard'>('soft');

    const checkEnabled = () => canDestroy() && mode() === 'hard' && props.category !== null;

    const refsQuery = useCheckCategoryReferences(
        () => props.category?.id ?? null,
        checkEnabled
    );

    const deactivateMutation = useDeactivateCategory();
    const hardDeleteMutation = useHardDeleteCategory();

    const isLoading = () => deactivateMutation.isPending || hardDeleteMutation.isPending;
    const hasReferences = () => {
        if (refsQuery.isPending) return false;
        return (refsQuery.data?.total ?? 0) > 0;
    };

    const handleConfirm = (confirmedMode: 'soft' | 'hard') => {
        if (!props.category) return;
        const id = props.category.id;
        if (confirmedMode === 'hard') {
            hardDeleteMutation.mutate(id, {
                onSuccess: () => {
                    props.onSuccess?.();
                    props.onClose();
                },
                onError: (err: any) => {
                    toast.error(err.message || 'Error al destruir permanentemente');
                }
            });
        } else {
            deactivateMutation.mutate(id, {
                onSuccess: () => {
                    props.onSuccess?.();
                    props.onClose();
                },
                onError: (err: any) => {
                    toast.error(err.message || 'Error al desactivar');
                }
            });
        }
    };

    const referenceLines = () => {
        if (refsQuery.isPending) return [];
        const data = refsQuery.data;
        if (!data) return [];
        const lines: string[] = [];
        if (data.products > 0) lines.push(`${data.products} producto(s) vinculado(s)`);
        return lines;
    };

    return (
        <DeleteDialog
            isOpen={!!props.category}
            onClose={props.onClose}
            onConfirm={handleConfirm}
            onModeChange={setMode}
            title="Eliminar categoría"
            description={props.category ? `${props.category.name}${props.category.path ? ` — ${props.category.path}` : ''}` : ''}
            allowHardDelete={canDestroy()}
            isLoading={isLoading()}
            softDeleteTitle="Desactivar"
            softDeleteDesc="La categoría quedará inactiva y podrá restaurarse en cualquier momento."
            hardDeleteTitle="Destruir permanentemente"
            hardDeleteDesc="Se eliminará de forma definitiva sin posibilidad de recuperación."
            softLoadingText="Desactivando..."
            hardLoadingText="Destruyendo..."
            isCheckingDependencies={refsQuery.isFetching}
            hasDependencies={hasReferences()}
            dependencyWarnings={referenceLines()}
            preventHardDeleteText="No se puede destruir"
            preventHardDeleteReason="Registros vinculados que lo impiden:"
            preventHardDeleteSuggestion={<>Usa <strong class="text-muted font-semibold">Desactivar</strong> para ocultar la categoría conservando las referencias.</>}
        />
    );
};

export default CategoryDeleteDialog;
