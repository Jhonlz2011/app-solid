import { Component, createSignal } from 'solid-js';
import { useAuth } from '@/modules/auth/store/auth.store';
import { useCheckSupplierReferences } from '../data/suppliers.queries';
import { useDeleteSupplier, useHardDeleteSupplier } from '../data/suppliers.mutations';
import type { SupplierListItem } from '../data/suppliers.api';
import type { EntityReferences } from '@app/schema/shared-dto';
import DeleteDialog from '@shared/ui/DeleteDialog';

export interface SupplierDeleteDialogProps {
    supplier: SupplierListItem | null;
    onClose: () => void;
    onSuccess?: () => void;
}

const SupplierDeleteDialog: Component<SupplierDeleteDialogProps> = (props) => {
    const auth = useAuth();
    const canDestroy = () => auth.hasPermission('suppliers.destroy');

    const [mode, setMode] = createSignal<'soft' | 'hard'>('soft');

    const checkEnabled = () => canDestroy() && mode() === 'hard' && props.supplier !== null;

    const refsQuery = useCheckSupplierReferences(
        () => props.supplier?.id ?? null,
        checkEnabled
    );
    
    const deactivateMutation = useDeleteSupplier();
    const hardDeleteMutation = useHardDeleteSupplier();

    const isLoading = () => deactivateMutation.isPending || hardDeleteMutation.isPending;
    const hasReferences = () => {
        if (refsQuery.isPending) return false;
        return (refsQuery.data?.total ?? 0) > 0;
    };

    const handleConfirm = (confirmedMode: 'soft' | 'hard') => {
        if (!props.supplier) return;
        const id = props.supplier.id;
        if (confirmedMode === 'hard') {
            hardDeleteMutation.mutate(id, { onSuccess: () => { props.onSuccess?.(); props.onClose(); } });
        } else {
            deactivateMutation.mutate(id, { onSuccess: () => { props.onSuccess?.(); props.onClose(); } });
        }
    };

    const referenceLines = () => {
        if (refsQuery.isPending) return [];
        const data = refsQuery.data as EntityReferences | undefined;
        if (!data) return [];
        const lines: string[] = [];
        if (data.supplierProducts > 0) lines.push(`${data.supplierProducts} producto(s) vinculado(s)`);
        if (data.invoices > 0) lines.push(`${data.invoices} documento(s) electrónico(s)`);
        if (data.workOrders > 0) lines.push(`${data.workOrders} orden(es) de trabajo`);
        return lines;
    };

    return (
        <DeleteDialog
            isOpen={!!props.supplier}
            onClose={props.onClose}
            onConfirm={handleConfirm}
            onModeChange={setMode}
            title="Eliminar proveedor"
            description={props.supplier?.business_name}
            allowHardDelete={canDestroy()}
            isLoading={isLoading()}
            softDeleteTitle="Eliminar"
            softDeleteDesc="El proveedor quedará inactivo y podrá restaurarse en cualquier momento."
            hardDeleteTitle="Destruir permanentemente"
            hardDeleteDesc="Se eliminará de forma definitiva sin posibilidad de recuperación."
            
            softLoadingText="Eliminando..."
            hardLoadingText="Destruyendo..."

            isCheckingDependencies={refsQuery.isFetching}
            hasDependencies={hasReferences()}
            dependencyWarnings={referenceLines()}
            preventHardDeleteText="No se puede destruir"
            preventHardDeleteReason="Registros vinculados que lo impiden:"
            preventHardDeleteSuggestion={<>Usa <strong class="text-muted font-semibold">Eliminar</strong> para ocultar el proveedor conservando el historial.</>}
        />
    );
};

export default SupplierDeleteDialog;
