import { Component, Show } from 'solid-js';
import { toast } from 'solid-sonner';
import { useSupplier, useUpdateSupplier } from '../data/suppliers.api';
import { EntityForm } from '@shared/forms/entity';
import type { EntityFormData } from '@app/schema/frontend';
import { ApiError } from '@shared/utils/api-errors';
import { SkeletonLoader } from '@shared/ui/SkeletonLoader';
import Sheet from '@shared/ui/Sheet';
import Button from '@shared/ui/Button';
import { FloppyDiskIcon } from '@shared/ui/icons';

interface SupplierEditSheetProps {
    supplierId: number;
    onClose: () => void;
    onBack?: () => void;
}

const SupplierEditSheet: Component<SupplierEditSheetProps> = (props) => {
    const supplierId = () => props.supplierId;

    const supplierQuery = useSupplier(supplierId);
    const updateMutation = useUpdateSupplier();

    const handleClose = () => {
        if (props.onBack) props.onBack();
        else props.onClose();
    };

    const handleSubmit = async (data: EntityFormData) => {
        if (supplierId() === 0) return;

        try {
            // Remove taxId and taxIdType as they are not allowed by SupplierUpdateSchema in backend
            const { taxId, taxIdType, ...updateData } = data;
            await updateMutation.mutateAsync({ id: supplierId(), data: updateData });
            toast.success('Proveedor actualizado correctamente');
            handleClose();
        } catch (error: any) {
            const hasFieldErrors = error instanceof ApiError && (error.errors?.length ?? 0) > 0;
            if (!hasFieldErrors) {
                toast.error(error?.message || 'Error al editar proveedor');
            }
            throw error;
        }
    };

    return (
        <Sheet
            isOpen={true}
            onClose={handleClose}
            onBack={props.onBack}
            title="Editar Proveedor"
            description="Modifica los datos del proveedor"
            size="xxxxl"
            footer={
                <>
                    <Button variant="outline" type="button" onClick={handleClose} disabled={updateMutation.isPending}>
                        Cancelar
                    </Button>
                    <Button
                        type="submit"
                        form="entity-form"
                        loading={updateMutation.isPending}
                        loadingText="Guardando..."
                        class="min-w-[200px]"
                        icon={<FloppyDiskIcon/>}
                    >
                        Guardar Cambios
                    </Button>
                </>
            }
        >
            <Show
                when={supplierId() > 0}
                fallback={
                    <div class="flex flex-col items-center justify-center py-12 text-center">
                        <div class="text-4xl mb-4">🔍</div>
                        <p class="text-muted">ID de proveedor inválido</p>
                        <p class="text-sm text-muted/70 mt-1">Verifica la URL e intenta de nuevo</p>
                    </div>
                }
            >
                <Show
                    when={!supplierQuery.isLoading}
                    fallback={
                        <div class="space-y-6 p-2">
                            <SkeletonLoader type="text" count={2} />
                            <SkeletonLoader type="text" count={3} />
                            <SkeletonLoader type="text" count={2} />
                        </div>
                    }
                >
                    <Show
                        when={supplierQuery.data}
                        fallback={
                            <div class="flex flex-col items-center justify-center py-12 text-center">
                                <div class="text-4xl mb-4">📭</div>
                                <p class="text-muted">No se encontró el proveedor</p>
                            </div>
                        }
                    >
                        <EntityForm
                            entity={supplierQuery.data}
                            onSubmit={handleSubmit}
                            isSubmitting={updateMutation.isPending}
                            lockedRoles={{ isSupplier: true }}
                        />
                    </Show>
                </Show>
            </Show>
        </Sheet>
    );
};

export default SupplierEditSheet;
