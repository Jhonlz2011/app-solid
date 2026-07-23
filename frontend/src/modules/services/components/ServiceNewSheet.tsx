/**
 * ServiceNewSheet — Thin shell for creating a new service.
 * Handles only Sheet chrome, footer buttons, and submit routing.
 */
import { Component } from 'solid-js';
import { Outlet } from '@tanstack/solid-router';
import { useSheetNavigation } from '@shared/hooks/useSheetNavigation';
import { toast } from 'solid-sonner';
import { useCreateProduct } from '@/modules/products/data/products.mutations';
import { CatalogForm, CATALOG_MODES } from '@shared/forms/catalog';
import type { ProductFormData } from '@app/schema/frontend';
import { ApiError, isNetworkError } from '@shared/utils/api-errors';
import { isOffline, showOfflineSavedToast } from '@shared/utils/offline-submit';
import { FloppyDiskIcon } from '@shared/ui/icons';
import Sheet from '@shared/ui/Sheet';
import Button from '@shared/ui/Button';

interface ServiceNewSheetProps {
    onClose?: () => void;
}

const ServiceNewSheet: Component<ServiceNewSheetProps> = (props) => {
    const { bindDismiss, close, navigateAway } = useSheetNavigation(props);
    const createMutation = useCreateProduct();

    const handleSubmit = async (data: ProductFormData) => {
        if (isOffline()) {
            createMutation.mutate(data);
            showOfflineSavedToast();
            close();
            return;
        }
        try {
            await createMutation.mutateAsync(data);
            toast.success('Servicio creado correctamente');
            close();
        } catch (error: any) {
            if (isNetworkError(error)) {
                toast.info('Guardado localmente', { description: 'Se sincronizará automáticamente al recuperar la conexión.', icon: '☁️' });
                close();
                return;
            }
            const hasFieldErrors = error instanceof ApiError && (error.errors?.length ?? 0) > 0;
            if (!hasFieldErrors) toast.error(error?.message || 'Error al crear servicio');
            throw error;
        }
    };

    return (
        <Sheet
            bindDismiss={bindDismiss}
            isOpen={true}
            onClose={navigateAway}
            title="Nuevo Servicio"
            description="Ingresa los datos del nuevo servicio"
            size="5xl"
            footer={
                <>
                    <Button variant="outline" type="button" onClick={close} disabled={createMutation.isPending}>
                        Cancelar
                    </Button>
                    <Button
                        type="submit"
                        form="service-form"
                        loading={createMutation.isPending}
                        loadingText="Creando..."
                        icon={<FloppyDiskIcon />}
                    >
                        Crear Servicio
                    </Button>
                </>
            }
        >
            <CatalogForm mode={CATALOG_MODES.SERVICIO}
                onSubmit={handleSubmit}
                isSubmitting={createMutation.isPending}
            />
            {/* Nested catalog creation sheets render here */}
            <Outlet />
        </Sheet>
    );
};

export default ServiceNewSheet;
