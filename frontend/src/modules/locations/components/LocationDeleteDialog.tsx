import { Component, createSignal } from 'solid-js';
import { useAuth } from '@/modules/auth/store/auth.store';
import { useCheckLocationReferences } from '../data/locations.queries';
import { useDeactivateLocation, useHardDeleteLocation } from '../data/locations.mutations';
import type { LocationItem } from '../data/locations.api';
import DeleteDialog from '@shared/ui/DeleteDialog';
import { toast } from 'solid-sonner';

export interface LocationDeleteDialogProps {
    location: LocationItem | null;
    onClose: () => void;
    onSuccess?: () => void;
}

const LocationDeleteDialog: Component<LocationDeleteDialogProps> = (props) => {
    const auth = useAuth();
    const canDestroy = () => auth.hasPermission('locations.destroy');

    const [mode, setMode] = createSignal<'soft' | 'hard'>('soft');

    const checkEnabled = () => canDestroy() && mode() === 'hard' && props.location !== null;

    const refsQuery = useCheckLocationReferences(
        () => props.location?.id ?? null,
        checkEnabled
    );

    const deactivateMutation = useDeactivateLocation();
    const hardDeleteMutation = useHardDeleteLocation();

    const isLoading = () => deactivateMutation.isPending || hardDeleteMutation.isPending;
    const hasReferences = () => {
        if (refsQuery.isPending) return false;
        return (refsQuery.data?.total ?? 0) > 0;
    };

    const handleConfirm = (confirmedMode: 'soft' | 'hard') => {
        if (!props.location) return;
        const id = props.location.id;
        if (confirmedMode === 'hard') {
            hardDeleteMutation.mutate(id, {
                onSuccess: () => {
                    props.onSuccess?.();
                    props.onClose();
                },
                onError: (err: any) => {
                    toast.error(err.message || 'Error al destruir permanentemente');
                }
            });
        } else {
            deactivateMutation.mutate(id, {
                onSuccess: () => {
                    props.onSuccess?.();
                    props.onClose();
                },
                onError: (err: any) => {
                    toast.error(err.message || 'Error al desactivar');
                }
            });
        }
    };

    const referenceLines = () => {
        if (refsQuery.isPending) return [];
        const data = refsQuery.data;
        if (!data) return [];
        const lines: string[] = [];
        if (data.stock > 0) lines.push(`${data.stock} registro(s) de stock`);
        if (data.movementsSrc > 0) lines.push(`${data.movementsSrc} movimiento(s) de salida`);
        if (data.movementsDest > 0) lines.push(`${data.movementsDest} movimiento(s) de entrada`);
        if (data.dimensionalItems > 0) lines.push(`${data.dimensionalItems} ítem(s) dimensional(es)`);
        return lines;
    };

    return (
        <DeleteDialog
            isOpen={!!props.location}
            onClose={props.onClose}
            onConfirm={handleConfirm}
            onModeChange={setMode}
            title="Eliminar ubicación"
            description={props.location ? `${props.location.name} — ${props.location.path}` : ''}
            allowHardDelete={canDestroy()}
            isLoading={isLoading()}
            softDeleteTitle="Desactivar"
            softDeleteDesc="La ubicación quedará inactiva y podrá restaurarse en cualquier momento."
            hardDeleteTitle="Destruir permanentemente"
            hardDeleteDesc="Se eliminará de forma definitiva sin posibilidad de recuperación."

            softLoadingText="Desactivando..."
            hardLoadingText="Destruyendo..."

            isCheckingDependencies={refsQuery.isFetching}
            hasDependencies={hasReferences()}
            dependencyWarnings={referenceLines()}
            preventHardDeleteText="No se puede destruir"
            preventHardDeleteReason="Registros vinculados que lo impiden:"
            preventHardDeleteSuggestion={<>Usa <strong class="text-muted font-semibold">Desactivar</strong> para ocultar la ubicación conservando las referencias.</>}
        />
    );
};

export default LocationDeleteDialog;
