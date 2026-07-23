/**
 * ServiceEditSheet — Thin shell for editing an existing service.
 * Handles only Sheet chrome, loading states, and submit routing.
 */
import { Component, Show } from 'solid-js';
import { useParams, Outlet } from '@tanstack/solid-router';
import { useSheetNavigation } from '@shared/hooks/useSheetNavigation';
import { toast } from 'solid-sonner';
import { useProduct } from '@/modules/products/data/products.queries';
import { useUpdateProduct } from '@/modules/products/data/products.mutations';
import { CatalogForm, CATALOG_MODES } from '@shared/forms/catalog';
import type { ProductFormData } from '@app/schema/frontend';
import { ApiError, isNetworkError } from '@shared/utils/api-errors';
import { isOffline, showOfflineSavedToast } from '@shared/utils/offline-submit';
import { SkeletonLoader } from '@shared/ui/SkeletonLoader';
import Sheet from '@shared/ui/Sheet';
import Button from '@shared/ui/Button';
import { FloppyDiskIcon } from '@shared/ui/icons';

interface ServiceEditSheetProps {
    serviceId?: number;
    onClose?: () => void;
    onBack?: () => void;
}

const ServiceEditSheet: Component<ServiceEditSheetProps> = (props) => {
    const params = useParams({ strict: false }) as () => any;
    const { bindDismiss, close, navigateAway } = useSheetNavigation(props);

    const serviceId = () => props.serviceId ?? Number(params()?.serviceId);

    const productQuery = useProduct(serviceId);
    const updateMutation = useUpdateProduct();

    const handleSubmit = async (data: ProductFormData) => {
        if (serviceId() === 0) return;

        if (isOffline()) {
            updateMutation.mutate({ id: serviceId(), data });
            showOfflineSavedToast();
            close();
            return;
        }
        try {
            await updateMutation.mutateAsync({ id: serviceId(), data });
            toast.success('Servicio actualizado correctamente');
            close();
        } catch (error: any) {
            if (isNetworkError(error)) {
                toast.info('Guardado localmente', { description: 'Se sincronizará automáticamente al recuperar la conexión.', icon: '☁️' });
                close();
                return;
            }
            const hasFieldErrors = error instanceof ApiError && (error.errors?.length ?? 0) > 0;
            if (!hasFieldErrors) {
                toast.error(error?.message || 'Error al editar servicio');
            }
            throw error;
        }
    };

    return (
        <Sheet
            bindDismiss={bindDismiss}
            isOpen={true}
            onClose={navigateAway}
            onBack={props.onBack}
            title="Editar Servicio"
            description="Modifica los datos del servicio"
            size="5xl"
            footer={
                <>
                    <Button variant="outline" type="button" onClick={close} disabled={updateMutation.isPending}>
                        Cancelar
                    </Button>
                    <Button
                        type="submit"
                        form="service-form"
                        loading={updateMutation.isPending}
                        loadingText="Guardando..."
                        icon={<FloppyDiskIcon />}
                    >
                        Guardar Cambios
                    </Button>
                </>
            }
        >
            <Show
                when={serviceId() > 0}
                fallback={
                    <div class="flex flex-col items-center justify-center py-12 text-center">
                        <div class="text-4xl mb-4">🔍</div>
                        <p class="text-muted">ID de servicio inválido</p>
                        <p class="text-sm text-muted/70 mt-1">Verifica la URL e intenta de nuevo</p>
                    </div>
                }
            >
                <Show
                    when={!productQuery.isLoading}
                    fallback={
                        <div class="space-y-6 p-2">
                            <SkeletonLoader type="text" count={2} />
                            <SkeletonLoader type="text" count={3} />
                            <SkeletonLoader type="text" count={2} />
                        </div>
                    }
                >
                    <Show
                        when={productQuery.data}
                        fallback={
                            <div class="flex flex-col items-center justify-center py-12 text-center">
                                <div class="text-4xl mb-4">📭</div>
                                <p class="text-muted">No se encontró el servicio</p>
                            </div>
                        }
                    >
                        <CatalogForm mode={CATALOG_MODES.SERVICIO}
                            product={productQuery.data}
                            onSubmit={handleSubmit}
                            isSubmitting={updateMutation.isPending}
                        />
                    </Show>
                </Show>
            </Show>
            {/* Nested catalog creation sheets render here */}
            <Outlet />
        </Sheet>
    );
};

export default ServiceEditSheet;
