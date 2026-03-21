import { Component, createSignal } from 'solid-js';
import { useAuth } from '@/modules/auth/store/auth.store';
import {
    useDeactivateUser,
    useHardDeleteUser,
    useCheckUserReferences,
} from '../data/users.queries';

import type { UserListItem, UserReferences } from '../models/users.types';

import DeleteDialog from '@shared/ui/DeleteDialog';

export interface UserDeleteDialogProps {
    user: UserListItem | null;
    onClose: () => void;
    onSuccess?: () => void;
}

const UserDeleteDialog: Component<UserDeleteDialogProps> = (props) => {
    const auth = useAuth();
    const canDestroy = () => auth.hasPermission('users.destroy');

    const [mode, setMode] = createSignal<'soft' | 'hard'>('soft');

    const checkEnabled = () => canDestroy() && mode() === 'hard' && props.user !== null;

    const refsQuery = useCheckUserReferences(
        () => props.user?.id ?? null,
        checkEnabled
    );
    
    const deactivateMutation = useDeactivateUser();
    const hardDeleteMutation = useHardDeleteUser();

    const isLoading = () => deactivateMutation.isPending || hardDeleteMutation.isPending;
    const hasReferences = () => (refsQuery.data?.total ?? 0) > 0;

    const handleConfirm = (confirmedMode: 'soft' | 'hard') => {
        if (!props.user) return;
        const id = props.user.id;
        if (confirmedMode === 'hard') {
            hardDeleteMutation.mutate(id, { onSuccess: () => { props.onSuccess?.(); props.onClose(); } });
        } else {
            deactivateMutation.mutate(id, { onSuccess: () => { props.onSuccess?.(); props.onClose(); } });
        }
    };

    const referenceLines = () => {
        const data = refsQuery.data as UserReferences | undefined;
        if (!data) return [];
        const lines: string[] = [];
        if (data.roles > 0) lines.push(`${data.roles} rol(es) asignado(s)`);
        if (data.activeSessions > 0) lines.push(`${data.activeSessions} sesión(es) activa(s)`);
        return lines;
    };

    return (
        <DeleteDialog
            isOpen={!!props.user}
            onClose={props.onClose}
            onConfirm={handleConfirm}
            onModeChange={setMode}
            title="Eliminar usuario"
            description={props.user?.username}
            allowHardDelete={canDestroy()}
            isLoading={isLoading()}
            softDeleteTitle="Desactivar"
            softDeleteDesc="El usuario quedará inactivo y podrá restaurarse en cualquier momento. Sus roles se conservarán."
            hardDeleteTitle="Destruir permanentemente"
            hardDeleteDesc="Se eliminará de forma definitiva junto con sus roles y sesiones, sin posibilidad de recuperación."
            
            softLoadingText="Desactivando..."
            hardLoadingText="Destruyendo..."

            isCheckingDependencies={refsQuery.isFetching}
            hasDependencies={hasReferences()}
            dependencyWarnings={referenceLines()}
            preventHardDeleteText="No se puede destruir"
            preventHardDeleteReason="Registros vinculados que lo impiden:"
            preventHardDeleteSuggestion={<>Usa <strong class="text-muted font-semibold">Desactivar</strong> para inhabilitar el usuario conservando el historial.</>}
        />
    );
};

export default UserDeleteDialog;
