import { Component, Show, createSignal, createEffect } from 'solid-js';
import { useSheetNavigation } from '@shared/hooks/useSheetNavigation';
import { toast } from 'solid-sonner';
import { useDeleteProduct, useHardDeleteProduct } from '../data/products.mutations';
import { useCheckProductReferences } from '../data/products.queries';
import type { ProductListItem } from '../data/products.api';
import Sheet from '@shared/ui/Sheet';
import Button from '@shared/ui/Button';
import { TrashIcon } from '@shared/ui/icons';

interface ProductDeleteDialogProps {
    product: ProductListItem | null;
    onClose: () => void;
    onSuccess?: () => void;
}

const ProductDeleteDialog: Component<ProductDeleteDialogProps> = (props) => {
    const [mode, setMode] = createSignal<'soft' | 'hard'>('soft');
    const deleteMutation = useDeleteProduct();
    const hardDeleteMutation = useHardDeleteProduct();
    const refsQuery = useCheckProductReferences(
        () => props.product?.id ?? null,
        () => mode() === 'hard' && !!props.product
    );

    createEffect(() => {
        if (props.product) setMode('soft');
    });

    const handleSoftDelete = () => {
        if (!props.product) return;
        deleteMutation.mutate(props.product.id, {
            onSuccess: () => { props.onSuccess?.(); props.onClose(); },
            onError: (err: any) => toast.error(err.message || 'Error al eliminar'),
        });
    };

    const handleHardDelete = () => {
        if (!props.product) return;
        hardDeleteMutation.mutate(props.product.id, {
            onSuccess: () => { toast.success('Producto eliminado permanentemente'); props.onClose(); },
            onError: (err: any) => toast.error(err.message || 'Error al eliminar'),
        });
    };

    return (
        <Show when={props.product}>
            {(product) => (
                <Sheet
                    isOpen={true}
                    onClose={props.onClose}
                    title="Eliminar Producto"
                    size="md"
                    footer={
                        <div class="flex items-center justify-between w-full">
                            <Show when={mode() === 'soft'}>
                                <button type="button" class="text-xs text-danger/60 hover:text-danger underline" onClick={() => setMode('hard')}>
                                    Eliminar permanentemente
                                </button>
                            </Show>
                            <Show when={mode() === 'hard'}>
                                <button type="button" class="text-xs text-muted hover:text-text underline" onClick={() => setMode('soft')}>
                                    Volver a desactivar
                                </button>
                            </Show>
                            <div class="flex gap-2">
                                <Button variant="outline" onClick={props.onClose}>Cancelar</Button>
                                <Show when={mode() === 'soft'}>
                                    <Button variant="danger" icon={<TrashIcon />} loading={deleteMutation.isPending} loadingText="Eliminando..." onClick={handleSoftDelete}>
                                        Desactivar
                                    </Button>
                                </Show>
                                <Show when={mode() === 'hard'}>
                                    <Button variant="danger" icon={<TrashIcon />} loading={hardDeleteMutation.isPending} loadingText="Eliminando..." onClick={handleHardDelete} disabled={refsQuery.data && !refsQuery.data.canDelete}>
                                        Eliminar Permanentemente
                                    </Button>
                                </Show>
                            </div>
                        </div>
                    }
                >
                    <div class="space-y-4">
                        <div class="bg-surface rounded-xl p-4 border border-border">
                            <p class="font-medium text-text">{product().name}</p>
                            <p class="text-sm text-muted font-mono">{product().sku}</p>
                        </div>

                        <Show when={mode() === 'soft'}>
                            <p class="text-sm text-muted">
                                El producto quedará <strong>inactivo</strong> y no aparecerá en búsquedas ni formularios.
                                Podrás restaurarlo en cualquier momento.
                            </p>
                        </Show>

                        <Show when={mode() === 'hard'}>
                            <div class="bg-danger/5 border border-danger/20 rounded-xl p-4">
                                <p class="text-sm text-danger font-medium mb-2">⚠️ Esta acción es irreversible</p>
                                <Show when={refsQuery.isLoading}>
                                    <p class="text-xs text-muted">Verificando referencias...</p>
                                </Show>
                                <Show when={refsQuery.data}>
                                    {(refs) => (
                                        <Show when={refs().total > 0} fallback={<p class="text-xs text-muted">No hay referencias. Se puede eliminar de forma segura.</p>}>
                                            <div class="space-y-1 text-xs text-danger/80">
                                                <Show when={refs().purchaseOrderItems}><p>• {refs().purchaseOrderItems} items en órdenes de compra</p></Show>
                                                <Show when={refs().invoiceItems}><p>• {refs().invoiceItems} items en facturas</p></Show>
                                                <Show when={refs().workOrderItems}><p>• {refs().workOrderItems} items en órdenes de trabajo</p></Show>
                                                <Show when={refs().inventoryMovements}><p>• {refs().inventoryMovements} movimientos de inventario</p></Show>
                                                <p class="mt-2 font-semibold text-danger">No se puede eliminar porque tiene {refs().total} referencias activas.</p>
                                            </div>
                                        </Show>
                                    )}
                                </Show>
                            </div>
                        </Show>
                    </div>
                </Sheet>
            )}
        </Show>
    );
};

export default ProductDeleteDialog;
