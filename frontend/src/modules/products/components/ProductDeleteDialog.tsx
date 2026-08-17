import { Component, createSignal } from 'solid-js';
import { useAuth } from '@/modules/auth/store/auth.store';
import { useCheckProductReferences } from '../data/products.queries';
import { useDeleteProduct, useHardDeleteProduct } from '../data/products.mutations';
import type { ProductListItem } from '../data/products.api';
import DeleteDialog from '@overlay/DeleteDialog';

export interface ProductDeleteDialogProps {
    product: ProductListItem | null;
    onClose: () => void;
    onSuccess?: () => void;
}

const ProductDeleteDialog: Component<ProductDeleteDialogProps> = (props) => {
    const auth = useAuth();
    const canDestroy = () => auth.hasPermission('products.destroy');

    const [mode, setMode] = createSignal<'soft' | 'hard'>('soft');

    const checkEnabled = () => canDestroy() && mode() === 'hard' && props.product !== null;

    const refsQuery = useCheckProductReferences(
        () => props.product?.id ?? null,
        checkEnabled
    );

    const deactivateMutation = useDeleteProduct();
    const hardDeleteMutation = useHardDeleteProduct();

    const isLoading = () => deactivateMutation.isPending || hardDeleteMutation.isPending;
    const hasReferences = () => {
        if (refsQuery.isPending) return false;
        return (refsQuery.data?.total ?? 0) > 0;
    };

    const handleConfirm = (confirmedMode: 'soft' | 'hard') => {
        if (!props.product) return;
        const id = props.product.id;
        if (confirmedMode === 'hard') {
            hardDeleteMutation.mutate(id, { onSuccess: () => { props.onSuccess?.(); props.onClose(); } });
        } else {
            deactivateMutation.mutate(id, { onSuccess: () => { props.onSuccess?.(); props.onClose(); } });
        }
    };

    const referenceLines = () => {
        if (refsQuery.isPending) return [];
        const data = refsQuery.data;
        if (!data) return [];
        const lines: string[] = [];
        if (data.purchaseOrderItems && data.purchaseOrderItems > 0) {
            lines.push(`${data.purchaseOrderItems} item(s) en órdenes de compra`);
        }
        if (data.invoiceItems && data.invoiceItems > 0) {
            lines.push(`${data.invoiceItems} item(s) en facturas`);
        }
        if (data.workOrderItems && data.workOrderItems > 0) {
            lines.push(`${data.workOrderItems} item(s) en órdenes de trabajo`);
        }
        if (data.inventoryMovements && data.inventoryMovements > 0) {
            lines.push(`${data.inventoryMovements} movimiento(s) de inventario`);
        }
        return lines;
    };

    return (
        <DeleteDialog
            isOpen={!!props.product}
            onClose={props.onClose}
            onConfirm={handleConfirm}
            onModeChange={setMode}
            title="Eliminar producto"
            description={props.product?.name}
            allowHardDelete={canDestroy()}
            isLoading={isLoading()}
            softDeleteTitle="Eliminar"
            softDeleteDesc="El producto quedará inactivo y podrá restaurarse en cualquier momento."
            hardDeleteTitle="Destruir permanentemente"
            hardDeleteDesc="Se eliminará de forma definitiva sin posibilidad de recuperación."
            
            softLoadingText="Eliminando..."
            hardLoadingText="Destruyendo..."

            isCheckingDependencies={refsQuery.isFetching}
            hasDependencies={hasReferences()}
            dependencyWarnings={referenceLines()}
            preventHardDeleteText="No se puede destruir"
            preventHardDeleteReason="Registros vinculados que lo impiden:"
            preventHardDeleteSuggestion={<>Usa <strong class="text-muted font-semibold">Eliminar</strong> para ocultar el producto conservando el historial.</>}
        />
    );
};

export default ProductDeleteDialog;
