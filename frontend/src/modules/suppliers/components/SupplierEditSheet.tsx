import { Component, Show } from 'solid-js';
import { useNavigate } from '@tanstack/solid-router';
import { toast } from 'solid-sonner';
import { useSupplier, useUpdateSupplier } from '../data/suppliers.api';
import { SupplierForm } from './SupplierForm';
import type { SupplierPayload } from '../models/supplier.types';
import { SkeletonLoader } from '@shared/ui/SkeletonLoader';
import Sheet from '@shared/ui/Sheet';

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
            toast.error(error.message || 'Error al actualizar proveedor');
        }
    };

    return (
        <Sheet
            isOpen={true}
            onClose={handleClose}
            title="Editar Proveedor"
            description="Modifica los datos del proveedor"
            size="lg"
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
                            onCancel={handleClose}
                        />
                    </Show>
                </Show>
            </Show>
        </Sheet>
    );
};

export default SupplierEditSheet;
