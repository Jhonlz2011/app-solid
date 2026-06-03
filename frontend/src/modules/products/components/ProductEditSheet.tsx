/**
 * ProductEditSheet — Thin shell for editing an existing product.
 * Handles only Sheet chrome, loading states, and submit routing.
 * All form logic lives in ProductForm.tsx.
 */
import { Component, Show } from 'solid-js';
import { useParams, Outlet } from '@tanstack/solid-router';
import { useSheetNavigation } from '@shared/hooks/useSheetNavigation';
import { toast } from 'solid-sonner';
import { useProduct } from '../data/products.queries';
import { useUpdateProduct } from '../data/products.mutations';
import { ProductForm } from './ProductForm';
import type { ProductFormData } from '@app/schema/frontend';
import { ApiError, isNetworkError } from '@shared/utils/api-errors';
import { SkeletonLoader } from '@shared/ui/SkeletonLoader';
import Sheet from '@shared/ui/Sheet';
import Button from '@shared/ui/Button';
import { FloppyDiskIcon } from '@shared/ui/icons';

interface ProductEditSheetProps {
    productId?: number;
    onClose?: () => void;
    onBack?: () => void;
}

const ProductEditSheet: Component<ProductEditSheetProps> = (props) => {
    const params = useParams({ strict: false }) as () => any;
    const { bindDismiss, close, navigateAway } = useSheetNavigation(props);

    const productId = () => props.productId ?? Number(params()?.productId);

    const productQuery = useProduct(productId);
    const updateMutation = useUpdateProduct();

    const handleSubmit = async (data: ProductFormData) => {
        if (productId() === 0) return;

        try {
            await updateMutation.mutateAsync({ id: productId(), data });
            toast.success('Producto actualizado correctamente');
            close();
        } catch (error: any) {
            if (isNetworkError(error)) {
                toast.info('Guardado localmente', { description: 'Se sincronizará automáticamente al recuperar la conexión.', icon: '☁️' });
                close();
                return;
            }
            const hasFieldErrors = error instanceof ApiError && (error.errors?.length ?? 0) > 0;
            if (!hasFieldErrors) {
                toast.error(error?.message || 'Error al editar producto');
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
            title="Editar Producto"
            description="Modifica los datos del producto"
            size="5xl"
            footer={
                <>
                    <Button variant="outline" type="button" onClick={close} disabled={updateMutation.isPending}>
                        Cancelar
                    </Button>
                    <Button
                        type="submit"
                        form="product-form"
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
                when={productId() > 0}
                fallback={
                    <div class="flex flex-col items-center justify-center py-12 text-center">
                        <div class="text-4xl mb-4">🔍</div>
                        <p class="text-muted">ID de producto inválido</p>
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
                                <p class="text-muted">No se encontró el producto</p>
                            </div>
                        }
                    >
                        <ProductForm
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

export default ProductEditSheet;
