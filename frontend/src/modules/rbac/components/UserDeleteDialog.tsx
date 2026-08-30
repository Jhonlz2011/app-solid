import { Component, createSignal } from 'solid-js';
import { useAuth } from '@/modules/auth/store/auth.store';
import { useCheckUserReferences } from '../data/users.queries';
import {
    useDeactivateUser,
    useHardDeleteUser,
} from '../data/users.mutations';

import type { UserListItemType, UserReferencesType } from '@app/schema/dto';

import DeleteDialog from '@overlay/DeleteDialog';

export interface UserDeleteDialogProps {
    user: UserListItemType | null;
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
    const hasReferences = () => {
        if (refsQuery.isPending) return false;
        return (refsQuery.data?.total ?? 0) > 0;
    };

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
        if (refsQuery.isPending) return [];
        const data = refsQuery.data as UserReferencesType | undefined;
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
            title="Gestionar acceso del usuario"
            description={props.user?.username}
            allowHardDelete={canDestroy()}
            isLoading={isLoading()}
            softDeleteTitle="Desactivar acceso"
            softDeleteDesc="El usuario quedará inactivo en esta empresa. Sus roles y asignaciones se conservarán para cuando se reactive."
            hardDeleteTitle="Remover de la empresa"
            hardDeleteDesc="El usuario será desvinculado de esta empresa y se revocarán sus roles."
            
            softLoadingText="Desactivando..."
            hardLoadingText="Removiendo..."

            isCheckingDependencies={refsQuery.isFetching}
            hasDependencies={hasReferences()}
            dependencyWarnings={referenceLines()}
            preventHardDeleteText="No se puede remover"
            preventHardDeleteReason="Registros vinculados que lo impiden:"
            preventHardDeleteSuggestion={<>Usa <strong class="text-muted font-semibold">Desactivar acceso</strong> para inhabilitar al usuario en esta empresa conservando el historial.</>}
        />
    );
};

export default UserDeleteDialog;
