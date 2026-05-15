import { Component, Show } from 'solid-js';
import { useParams } from '@tanstack/solid-router';
import { useSheetNavigation } from '@shared/hooks/useSheetNavigation';
import { toast } from 'solid-sonner';
import { useCategoryDetail } from '../data/categories.queries';
import { useUpdateCategory, useDeactivateCategory, useRestoreCategory } from '../data/categories.mutations';
import CategoryForm from './CategoryForm';
import type { CategoryFormData } from '@app/schema/frontend';
import { ApiError } from '@shared/utils/api-errors';
import { SkeletonLoader } from '@shared/ui/SkeletonLoader';
import Sheet from '@shared/ui/Sheet';
import Button from '@shared/ui/Button';
import { FloppyDiskIcon } from '@shared/ui/icons';

interface CategoryEditSheetProps {
    categoryId?: number;
    onClose?: () => void;
    onBack?: () => void;
}

const CategoryEditSheet: Component<CategoryEditSheetProps> = (props) => {
    const params = useParams({ strict: false }) as () => { categoryId?: string };
    const { bindDismiss, close, navigateAway } = useSheetNavigation(props);
    
    const categoryId = () => {
        if (props.categoryId) return props.categoryId;
        const parsed = Number(params()?.categoryId);
        return Number.isFinite(parsed) ? parsed : 0;
    };

    const categoryQuery = useCategoryDetail(categoryId);
    const updateMutation = useUpdateCategory();
    const deactivateMut = useDeactivateCategory();
    const restoreMut = useRestoreCategory();

    const handleSubmit = async (data: CategoryFormData) => {
        if (categoryId() === 0) return;

        try {
            await updateMutation.mutateAsync({ id: categoryId(), data });
            toast.success('Categoría actualizada correctamente');
            navigateAway();
        } catch (error: any) {
            const hasFieldErrors = error instanceof ApiError && (error.errors?.length ?? 0) > 0;
            if (!hasFieldErrors) {
                toast.error(error?.message || 'Error al editar categoría');
            }
            throw error;
        }
    };

    const handleToggleActive = () => {
        const id = categoryId();
        if (!id) return;
        const isActive = categoryQuery.data?.is_active;

        if (isActive) {
            deactivateMut.mutate(id, {
                onSuccess: () => { toast.success('Categoría desactivada'); navigateAway(); },
                onError: (err: any) => toast.error(err.message || 'Error'),
            });
        } else {
            restoreMut.mutate(id, {
                onSuccess: () => { toast.success('Categoría restaurada'); navigateAway(); },
                onError: (err: any) => toast.error(err.message || 'Error'),
            });
        }
    };

    const isSaving = () => updateMutation.isPending || deactivateMut.isPending || restoreMut.isPending;

    return (
        <Sheet
            bindDismiss={bindDismiss}
            isOpen={true}
            onClose={navigateAway}
            onBack={props.onBack}
            title="Editar Categoría"
            description="Modifica los datos de la categoría"
            size="xxl"
            footer={
                <>
                    <Show when={categoryId() > 0 && categoryQuery.data}>
                        <Button
                            variant={categoryQuery.data?.is_active ? 'danger' : 'success'}
                            onClick={handleToggleActive}
                            loading={deactivateMut.isPending || restoreMut.isPending}
                        >
                            {categoryQuery.data?.is_active ? 'Desactivar' : 'Restaurar'}
                        </Button>
                    </Show>
                    <div class="flex-1" />
                    <Button variant="outline" type="button" onClick={close} disabled={isSaving()}>
                        Cancelar
                    </Button>
                    <Button
                        type="submit"
                        form="category-form"
                        loading={updateMutation.isPending}
                        loadingText="Guardando..."
                        icon={<FloppyDiskIcon/>}
                    >
                        Guardar Cambios
                    </Button>
                </>
            }
        >
            <Show
                when={categoryId() > 0}
                fallback={
                    <div class="flex flex-col items-center justify-center py-12 text-center">
                        <div class="text-4xl mb-4">🔍</div>
                        <p class="text-muted">ID de categoría inválido</p>
                        <p class="text-sm text-muted/70 mt-1">Verifica la URL e intenta de nuevo</p>
                    </div>
                }
            >
                <Show
                    when={!categoryQuery.isLoading}
                    fallback={
                        <div class="space-y-6 p-2">
                            <SkeletonLoader type="text" count={2} />
                            <SkeletonLoader type="text" count={3} />
                            <SkeletonLoader type="text" count={2} />
                        </div>
                    }
                >
                    <Show
                        when={categoryQuery.data}
                        fallback={
                            <div class="flex flex-col items-center justify-center py-12 text-center">
                                <div class="text-4xl mb-4">📭</div>
                                <p class="text-muted">No se encontró la categoría</p>
                            </div>
                        }
                    >
                        <CategoryForm
                            category={categoryQuery.data}
                            onSubmit={handleSubmit}
                            isSubmitting={updateMutation.isPending}
                        />
                    </Show>
                </Show>
            </Show>
        </Sheet>
    );
};

export default CategoryEditSheet;
