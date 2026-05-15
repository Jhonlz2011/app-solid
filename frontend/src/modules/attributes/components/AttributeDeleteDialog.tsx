import { Component, createSignal } from 'solid-js';
import { useAuth } from '@/modules/auth/store/auth.store';
import { useCheckAttributeReferences } from '../data/attributes.queries';
import { useDeactivateAttribute, useHardDeleteAttribute } from '../data/attributes.mutations';
import type { AttributeItem } from '../data/attributes.api';
import DeleteDialog from '@shared/ui/DeleteDialog';

export interface AttributeDeleteDialogProps {
    attribute: AttributeItem | null;
    onClose: () => void;
    onSuccess?: () => void;
}

const AttributeDeleteDialog: Component<AttributeDeleteDialogProps> = (props) => {
    const auth = useAuth();
    const canDestroy = () => auth.hasPermission('attributes.destroy');

    const [mode, setMode] = createSignal<'soft' | 'hard'>('soft');

    const checkEnabled = () => canDestroy() && mode() === 'hard' && props.attribute !== null;

    const refsQuery = useCheckAttributeReferences(
        () => props.attribute?.id ?? null,
        checkEnabled
    );

    const deactivateMutation = useDeactivateAttribute();
    const hardDeleteMutation = useHardDeleteAttribute();

    const isLoading = () => deactivateMutation.isPending || hardDeleteMutation.isPending;
    const hasReferences = () => {
        if (refsQuery.isPending) return false;
        return (refsQuery.data?.total ?? 0) > 0;
    };

    const handleConfirm = (confirmedMode: 'soft' | 'hard') => {
        if (!props.attribute) return;
        const id = props.attribute.id;
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
        if (data.categories > 0) lines.push(`${data.categories} categoría(s) vinculada(s)`);
        return lines;
    };

    return (
        <DeleteDialog
            isOpen={!!props.attribute}
            onClose={props.onClose}
            onConfirm={handleConfirm}
            onModeChange={setMode}
            title="Eliminar atributo"
            description={props.attribute ? `${props.attribute.key} — ${props.attribute.label}` : ''}
            allowHardDelete={canDestroy()}
            isLoading={isLoading()}
            softDeleteTitle="Desactivar"
            softDeleteDesc="El atributo quedará inactivo y podrá restaurarse en cualquier momento."
            hardDeleteTitle="Destruir permanentemente"
            hardDeleteDesc="Se eliminará de forma definitiva sin posibilidad de recuperación."

            softLoadingText="Desactivando..."
            hardLoadingText="Destruyendo..."

            isCheckingDependencies={refsQuery.isFetching}
            hasDependencies={hasReferences()}
            dependencyWarnings={referenceLines()}
            preventHardDeleteText="No se puede destruir"
            preventHardDeleteReason="Registros vinculados que lo impiden:"
            preventHardDeleteSuggestion={<>Usa <strong class="text-muted font-semibold">Desactivar</strong> para ocultar el atributo conservando las referencias.</>}
        />
    );
};

export default AttributeDeleteDialog;
