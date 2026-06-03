import { Component } from 'solid-js';
import { useSearch, Outlet } from '@tanstack/solid-router';
import { useSheetNavigation } from '@shared/hooks/useSheetNavigation';
import { toast } from 'solid-sonner';
import { useCreateCategory } from '../data/categories.mutations';
import CategoryForm from './CategoryForm';
import type { CategoryFormData } from '@app/schema/frontend';
import { ApiError, isNetworkError } from '@shared/utils/api-errors';
import { isOffline, showOfflineSavedToast } from '@shared/utils/offline-submit';
import { FloppyDiskIcon } from '@shared/ui/icons';
import Sheet from '@shared/ui/Sheet';
import Button from '@shared/ui/Button';

interface CategoryNewSheetProps {
    onClose?: () => void;
}

const CategoryNewSheet: Component<CategoryNewSheetProps> = (props) => {
    const search = useSearch({ strict: false }) as () => { parentId?: string };
    const { bindDismiss, close, navigateAway } = useSheetNavigation(props);
    const createMutation = useCreateCategory();

    const defaultParentId = () => {
        const raw = search()?.parentId;
        const id = Number(raw);
        return Number.isFinite(id) && id > 0 ? id : undefined;
    };

    const handleSubmit = async (data: CategoryFormData) => {
        if (isOffline()) {
            createMutation.mutate(data);
            showOfflineSavedToast();
            navigateAway();
            return;
        }
        try {
            await createMutation.mutateAsync(data);
            toast.success('Categoría creada correctamente');
            navigateAway();
        } catch (error: any) {
            if (isNetworkError(error)) {
                toast.info('Guardado localmente', { description: 'Se sincronizará automáticamente al recuperar la conexión.', icon: '☁️' });
                navigateAway();
                return;
            }
            const hasFieldErrors = error instanceof ApiError && (error.errors?.length ?? 0) > 0;
            if (!hasFieldErrors) toast.error(error?.message || 'Error al crear la categoría');
            throw error;
        }
    };

    return (
        <Sheet
            bindDismiss={bindDismiss}
            isOpen={true}
            onClose={navigateAway}
            title="Nueva Categoría"
            description="Crear una nueva categoría para organizar productos"
            size="xxl"
            footer={
                <>
                    <Button variant="outline" type="button" onClick={close} disabled={createMutation.isPending}>
                        Cancelar
                    </Button>
                    <Button
                        type="submit"
                        form="category-new-form"
                        loading={createMutation.isPending}
                        loadingText="Creando..."
                        icon={<FloppyDiskIcon />}
                    >
                        Crear Categoría
                    </Button>
                </>
            }
        >
            <CategoryForm
                onSubmit={handleSubmit}
                isSubmitting={createMutation.isPending}
                defaultParentId={defaultParentId()}
                formId="category-new-form"
            />
            <Outlet />
        </Sheet>
    );
};

export default CategoryNewSheet;
