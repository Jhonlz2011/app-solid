import { Component, Show } from 'solid-js';
import { useNavigate } from '@tanstack/solid-router';
import { toast } from 'solid-sonner';
import { useSupplier, useUpdateSupplier } from '../data/suppliers.api';
import { SupplierForm } from './SupplierForm';
import type { SupplierPayload } from '../models/supplier.types';
import { ApiError } from '@shared/utils/api-errors';
import { SkeletonLoader } from '@shared/ui/SkeletonLoader';
import Sheet from '@shared/ui/Sheet';
import Button from '@shared/ui/Button';
import { FloppyDiskIcon } from '@shared/ui/icons';

interface SupplierEditSheetProps {
    supplierId: number;
}

const SupplierEditSheet: Component<SupplierEditSheetProps> = (props) => {
    const navigate = useNavigate();

    // Use TanStack Query hook with the passed supplierId
    const supplierQuery = useSupplier(() => props.supplierId);
    const updateMutation = useUpdateSupplier();

    const handleClose = () => {
        navigate({ to: '/suppliers' });
    };

    const handleSubmit = async (data: SupplierPayload) => {
        if (!props.supplierId) return;

        try {
            await updateMutation.mutateAsync({ id: props.supplierId, data });
            toast.success('Proveedor actualizado correctamente');
            handleClose();
        } catch (error: any) {
            const hasFieldErrors = error instanceof ApiError && (error.errors?.length ?? 0) > 0;
            if (!hasFieldErrors) {
                toast.error(error?.message || 'Error al editar proveedor');
            }
            throw error; // Re-throw so SupplierForm can map field errors
        }
    };

    return (
        <Sheet
            isOpen={true}
            onClose={handleClose}
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
                        form="supplier-form"
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
                when={props.supplierId > 0}
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
                        <SupplierForm
                            supplier={supplierQuery.data}
                            onSubmit={handleSubmit}
                            isSubmitting={updateMutation.isPending}
                        />
                    </Show>
                </Show>
            </Show>
        </Sheet>
    );
};

export default SupplierEditSheet;
