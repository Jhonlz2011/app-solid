import { Component, createSignal } from 'solid-js';
import { useAuth } from '@/modules/auth/store/auth.store';
import { useCheckUomReferences } from '../data/uom.queries';
import { useDeactivateUom, useHardDeleteUom } from '../data/uom.mutations';
import type { UomItem } from '../data/uom.api';
import DeleteDialog from '@shared/ui/DeleteDialog';

export interface UomDeleteDialogProps {
    uom: UomItem | null;
    onClose: () => void;
    onSuccess?: () => void;
}

const UomDeleteDialog: Component<UomDeleteDialogProps> = (props) => {
    const auth = useAuth();
    const canDestroy = () => auth.hasPermission('uom.destroy');

    const [mode, setMode] = createSignal<'soft' | 'hard'>('soft');

    const checkEnabled = () => canDestroy() && mode() === 'hard' && props.uom !== null;

    const refsQuery = useCheckUomReferences(
        () => props.uom?.id ?? null,
        checkEnabled
    );

    const deactivateMutation = useDeactivateUom();
    const hardDeleteMutation = useHardDeleteUom();

    const isLoading = () => deactivateMutation.isPending || hardDeleteMutation.isPending;
    const hasReferences = () => {
        if (refsQuery.isPending) return false;
        return (refsQuery.data?.total ?? 0) > 0;
    };

    const handleConfirm = (confirmedMode: 'soft' | 'hard') => {
        if (!props.uom) return;
        const id = props.uom.id;
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
        if (data.products > 0) lines.push(`${data.products} producto(s) vinculado(s)`);
        if (data.variants > 0) lines.push(`${data.variants} variante(s) de producto`);
        if (data.supplierProducts > 0) lines.push(`${data.supplierProducts} producto(s) de proveedor`);
        if (data.conversions > 0) lines.push(`${data.conversions} conversión(es) de unidad`);
        if (data.workOrderItems > 0) lines.push(`${data.workOrderItems} ítem(s) de orden de trabajo`);
        if (data.quoteItems > 0) lines.push(`${data.quoteItems} ítem(s) de cotización de compra`);
        return lines;
    };

    return (
        <DeleteDialog
            isOpen={!!props.uom}
            onClose={props.onClose}
            onConfirm={handleConfirm}
            onModeChange={setMode}
            title="Eliminar unidad de medida"
            description={props.uom ? `${props.uom.code} — ${props.uom.name}` : ''}
            allowHardDelete={canDestroy()}
            isLoading={isLoading()}
            softDeleteTitle="Desactivar"
            softDeleteDesc="La unidad quedará inactiva y podrá restaurarse en cualquier momento."
            hardDeleteTitle="Destruir permanentemente"
            hardDeleteDesc="Se eliminará de forma definitiva sin posibilidad de recuperación."

            softLoadingText="Desactivando..."
            hardLoadingText="Destruyendo..."

            isCheckingDependencies={refsQuery.isFetching}
            hasDependencies={hasReferences()}
            dependencyWarnings={referenceLines()}
            preventHardDeleteText="No se puede destruir"
            preventHardDeleteReason="Registros vinculados que lo impiden:"
            preventHardDeleteSuggestion={<>Usa <strong class="text-muted font-semibold">Desactivar</strong> para ocultar la unidad conservando las referencias.</>}
        />
    );
};

export default UomDeleteDialog;
