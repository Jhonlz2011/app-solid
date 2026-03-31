import { Component, createSignal } from 'solid-js';
import { useAuth } from '@/modules/auth/store/auth.store';
import {
    useDeleteClient,
    useHardDeleteClient,
    useCheckClientReferences,
    type ClientListItem,
    type ClientReferences,
} from '../data/clients.api';
import DeleteDialog from '@shared/ui/DeleteDialog';

export interface ClientDeleteDialogProps {
    client: ClientListItem | null;
    onClose: () => void;
    onSuccess?: () => void;
}

const ClientDeleteDialog: Component<ClientDeleteDialogProps> = (props) => {
    const auth = useAuth();
    const canDestroy = () => auth.hasPermission('clients.destroy');

    const [mode, setMode] = createSignal<'soft' | 'hard'>('soft');

    const checkEnabled = () => canDestroy() && mode() === 'hard' && props.client !== null;

    const refsQuery = useCheckClientReferences(
        () => props.client?.id ?? null,
        checkEnabled
    );
    
    const deactivateMutation = useDeleteClient();
    const hardDeleteMutation = useHardDeleteClient();

    const isLoading = () => deactivateMutation.isPending || hardDeleteMutation.isPending;
    const hasReferences = () => (refsQuery.data?.total ?? 0) > 0;

    const handleConfirm = (confirmedMode: 'soft' | 'hard') => {
        if (!props.client) return;
        const id = props.client.id;
        if (confirmedMode === 'hard') {
            hardDeleteMutation.mutate(id, { onSuccess: () => { props.onSuccess?.(); props.onClose(); } });
        } else {
            deactivateMutation.mutate(id, { onSuccess: () => { props.onSuccess?.(); props.onClose(); } });
        }
    };

    const referenceLines = () => {
        const data = refsQuery.data as ClientReferences | undefined;
        if (!data) return [];
        const lines: string[] = [];
        if (data.clientProducts > 0) lines.push(`${data.clientProducts} producto(s) vinculado(s)`);
        if (data.invoices > 0) lines.push(`${data.invoices} documento(s) electrónico(s)`);
        if (data.workOrders > 0) lines.push(`${data.workOrders} orden(es) de trabajo`);
        return lines;
    };

    return (
        <DeleteDialog
            isOpen={!!props.client}
            onClose={props.onClose}
            onConfirm={handleConfirm}
            onModeChange={setMode}
            title="Eliminar cliente"
            description={props.client?.business_name}
            allowHardDelete={canDestroy()}
            isLoading={isLoading()}
            softDeleteTitle="Eliminar"
            softDeleteDesc="El cliente quedará inactivo y podrá restaurarse en cualquier momento."
            hardDeleteTitle="Destruir permanentemente"
            hardDeleteDesc="Se eliminará de forma definitiva sin posibilidad de recuperación."
            
            softLoadingText="Eliminando..."
            hardLoadingText="Destruyendo..."

            isCheckingDependencies={refsQuery.isFetching}
            hasDependencies={hasReferences()}
            dependencyWarnings={referenceLines()}
            preventHardDeleteText="No se puede destruir"
            preventHardDeleteReason="Registros vinculados que lo impiden:"
            preventHardDeleteSuggestion={<>Usa <strong class="text-muted font-semibold">Eliminar</strong> para ocultar el cliente conservando el historial.</>}
        />
    );
};

export default ClientDeleteDialog;
