import { Component, createSignal } from 'solid-js';
import { toast } from 'solid-sonner';
import { useAuth } from '@/modules/auth/store/auth.store';
import type { EntityReferencesType } from '@app/schema/dto';
import type { RbacModule } from '@app/schema/enums';
import type { EntityListItem } from '../data/entities.api';
import DeleteDialog from '@overlay/DeleteDialog';

export interface EntityDeleteDialogProps {
    entity: EntityListItem | null;
    permissionKey: RbacModule;
    entityNameSingular?: string;
    useCheckReferences: (id: () => string | null, enabled: () => boolean) => any;
    deleteMutation: {
        mutate: (id: string, options?: any) => void;
        isPending: boolean;
    };
    hardDeleteMutation: {
        mutate: (id: string, options?: any) => void;
        isPending: boolean;
    };
    onClose: () => void;
    onSuccess?: () => void;
}

export const EntityDeleteDialog: Component<EntityDeleteDialogProps> = (props) => {
    const auth = useAuth();
    const canDestroy = () => auth.hasPermission(`${props.permissionKey}.destroy`);

    const [mode, setMode] = createSignal<'soft' | 'hard'>('soft');

    const checkEnabled = () => canDestroy() && mode() === 'hard' && props.entity !== null;

    const refsQuery = props.useCheckReferences(
        () => props.entity?.id ?? null,
        checkEnabled
    );

    const isLoading = () => props.deleteMutation.isPending || props.hardDeleteMutation.isPending;
    const hasReferences = () => {
        if (refsQuery.isPending) return false;
        return (refsQuery.data?.total ?? 0) > 0;
    };

    const nameSingular = () => props.entityNameSingular || 'registro';

    const handleConfirm = (confirmedMode: 'soft' | 'hard') => {
        if (!props.entity) return;
        const id = props.entity.id;
        const name = props.entity.business_name || nameSingular();

        if (confirmedMode === 'hard') {
            props.hardDeleteMutation.mutate(id, {
                onSuccess: () => {
                    toast.success(`Se ha destruido permanentemente '${name}'`);
                    props.onSuccess?.();
                    props.onClose();
                },
                onError: (err: any) => {
                    toast.error(err.message || `Error al destruir ${nameSingular()}`);
                },
            });
        } else {
            props.deleteMutation.mutate(id, {
                onSuccess: () => {
                    toast.success(`Se ha eliminado '${name}'`);
                    props.onSuccess?.();
                    props.onClose();
                },
                onError: (err: any) => {
                    toast.error(err.message || `Error al eliminar ${nameSingular()}`);
                },
            });
        }
    };

    const referenceLines = () => {
        if (refsQuery.isPending) return [];
        const data = refsQuery.data as EntityReferencesType | undefined;
        if (!data) return [];
        const lines: string[] = [];
        if (data.supplierProducts > 0) lines.push(`${data.supplierProducts} producto(s) vinculado(s)`);
        if (data.invoices > 0) lines.push(`${data.invoices} documento(s) electrónico(s)`);
        if (data.workOrders > 0) lines.push(`${data.workOrders} orden(es) de trabajo`);
        return lines;
    };

    return (
        <DeleteDialog
            isOpen={!!props.entity}
            onClose={props.onClose}
            onConfirm={handleConfirm}
            onModeChange={setMode}
            title={`Eliminar ${nameSingular()}`}
            description={props.entity?.business_name}
            allowHardDelete={canDestroy()}
            isLoading={isLoading()}
            softDeleteTitle="Eliminar"
            softDeleteDesc={`El ${nameSingular()} quedará inactivo y podrá restaurarse en cualquier momento.`}
            hardDeleteTitle="Destruir permanentemente"
            hardDeleteDesc="Se eliminará de forma definitiva sin posibilidad de recuperación."
            softLoadingText="Eliminando..."
            hardLoadingText="Destruyendo..."
            isCheckingDependencies={refsQuery.isFetching}
            hasDependencies={hasReferences()}
            dependencyWarnings={referenceLines()}
            preventHardDeleteText="No se puede destruir"
            preventHardDeleteReason="Registros vinculados que lo impiden:"
            preventHardDeleteSuggestion={<>Usa <strong class="text-muted font-semibold">Eliminar</strong> para ocultar el {nameSingular()} conservando el historial.</>}
        />
    );
};

export default EntityDeleteDialog;
