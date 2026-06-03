/**
 * ProductNewSheet — Thin shell for creating a new product.
 * Handles only Sheet chrome, footer buttons, and submit routing.
 * All form logic lives in ProductForm.tsx.
 */
import { Component } from 'solid-js';
import { Outlet } from '@tanstack/solid-router';
import { useSheetNavigation } from '@shared/hooks/useSheetNavigation';
import { toast } from 'solid-sonner';
import { useCreateProduct } from '../data/products.mutations';
import { ProductForm } from './ProductForm';
import type { ProductFormData } from '@app/schema/frontend';
import { ApiError, isNetworkError } from '@shared/utils/api-errors';
import { FloppyDiskIcon } from '@shared/ui/icons';
import Sheet from '@shared/ui/Sheet';
import Button from '@shared/ui/Button';

interface ProductNewSheetProps {
    onClose?: () => void;
}

const ProductNewSheet: Component<ProductNewSheetProps> = (props) => {
    const { bindDismiss, close, navigateAway } = useSheetNavigation(props);
    const createMutation = useCreateProduct();

    const handleSubmit = async (data: ProductFormData) => {
        try {
            await createMutation.mutateAsync(data);
            toast.success('Producto creado correctamente');
            close();
        } catch (error: any) {
            if (isNetworkError(error)) {
                toast.info('Guardado localmente', { description: 'Se sincronizará automáticamente al recuperar la conexión.', icon: '☁️' });
                close();
                return;
            }
            const hasFieldErrors = error instanceof ApiError && (error.errors?.length ?? 0) > 0;
            if (!hasFieldErrors) toast.error(error?.message || 'Error al crear producto');
            throw error;
        }
    };

    return (
        <Sheet
            bindDismiss={bindDismiss}
            isOpen={true}
            onClose={navigateAway}
            title="Nuevo Producto"
            description="Ingresa los datos del nuevo producto"
            size="5xl"
            footer={
                <>
                    <Button variant="outline" type="button" onClick={close} disabled={createMutation.isPending}>
                        Cancelar
                    </Button>
                    <Button
                        type="submit"
                        form="product-form"
                        loading={createMutation.isPending}
                        loadingText="Creando..."
                        icon={<FloppyDiskIcon />}
                    >
                        Crear Producto
                    </Button>
                </>
            }
        >
            <ProductForm
                onSubmit={handleSubmit}
                isSubmitting={createMutation.isPending}
            />
            {/* Nested catalog creation sheets render here */}
            <Outlet />
        </Sheet>
    );
};

export default ProductNewSheet;
