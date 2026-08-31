import { Component, Show } from 'solid-js';
import { useParams } from '@tanstack/solid-router';
import { useSheetNavigation } from '@shared/hooks/useSheetNavigation';
import { executeFormMutation } from '@shared/utils/form.utils';
import { toast } from 'solid-sonner';
import type { UserUpdateData } from '@app/schema/frontend';
import Sheet from '@overlay/Sheet';
import Button from '@form/Button';
import { FloppyDiskIcon } from '@icons/FloppyDiskIcon';
import { InfoIcon } from '@icons/InfoIcon';
import { SkeletonLoader } from '@display/SkeletonLoader';
import { useUser, useRoles } from '../data/users.queries';
import {
    useUpdateUser, useAssignUserRoles,
    useSetUserEntity, useAdminResetPassword,
    useDeactivateUser, useRestoreUser,
} from '../data/users.mutations';
import { UserEditForm } from './UserEditForm';

interface UserEditSheetProps {
    userId?: string;
    onClose?: () => void;
}

const UserEditSheet: Component<UserEditSheetProps> = (props) => {
    const params = useParams({ strict: false }) as () => { userId?: string };
    const { bindDismiss, close, navigateAway } = useSheetNavigation(props);
    const initialUserId = props.userId ?? params()?.userId;
    const userId = () => props.userId ?? params()?.userId ?? initialUserId;

    const userQuery = useUser(userId);
    const rolesQuery = useRoles();
    const updateMutation = useUpdateUser();
    const assignRolesMutation = useAssignUserRoles();
    const setEntityMutation = useSetUserEntity();
    const resetPwMutation = useAdminResetPassword();
    const deactivateMut = useDeactivateUser();
    const restoreMut = useRestoreUser();

    const handleSubmit = async (values: UserUpdateData & { newPassword?: string }) => {
        const targetId = userId();
        if (!targetId) return;

        try {
            const promises: Promise<unknown>[] = [
                updateMutation.mutateAsync({
                    id: targetId,
                    isActive: values.isActive,
                    roleIds: values.roleIds,
                    entityId: values.entityId,
                }),
                assignRolesMutation.mutateAsync({
                    userId: targetId,
                    roleIds: values.roleIds,
                }),
            ];

            // Entity change fallback if needed
            const currentEntityId = userQuery.data?.entityId ?? null;
            if (values.entityId !== undefined && values.entityId !== currentEntityId) {
                promises.push(
                    setEntityMutation.mutateAsync({
                        userId: targetId,
                        entityId: values.entityId,
                    })
                );
            }

            // Password reset
            if (values.newPassword) {
                promises.push(
                    resetPwMutation.mutateAsync({
                        userId: targetId,
                        newPassword: values.newPassword,
                    })
                );
            }

            await Promise.all(promises);

            const msgs = ['Usuario actualizado correctamente'];
            if (values.newPassword) msgs.push('Contraseña restablecida — sesiones cerradas');
            toast.success(msgs.join('. '));
            close();
        } catch (err: any) {
            toast.error(err?.message || 'Error al actualizar usuario');
        }
    };

    const handleToggleActive = () => {
        const u = userQuery.data;
        if (!u) return;
        const isActive = u.isActive ?? true;
        const mut = isActive ? deactivateMut : restoreMut;

        executeFormMutation({
            mutation: mut,
            variables: u.id,
            successMessage: isActive ? 'Usuario desactivado' : 'Usuario restaurado',
            onComplete: close,
        });
    };

    const isPending = () =>
        updateMutation.isPending || assignRolesMutation.isPending ||
        setEntityMutation.isPending || resetPwMutation.isPending ||
        deactivateMut.isPending || restoreMut.isPending;

    return (
        <Sheet
            bindDismiss={bindDismiss}
            isOpen={true}
            onClose={navigateAway}
            title="Editar Usuario"
            description="Modifica los datos de la cuenta"
            size="lg"
            footer={
                <>
                    <Show when={userQuery.data}>
                        <Button
                            variant={(userQuery.data?.isActive ?? true) ? 'danger' : 'success'}
                            onClick={handleToggleActive}
                            loading={deactivateMut.isPending || restoreMut.isPending}
                            loadingText={(userQuery.data?.isActive ?? true) ? 'Desactivando...' : 'Restaurando...'}
                            disabled={isPending()}
                        >
                            {(userQuery.data?.isActive ?? true) ? 'Desactivar' : 'Restaurar'}
                        </Button>
                    </Show>
                    <div class="flex-1" />
                    <Button variant="outline" onClick={close} disabled={isPending()}>
                        Cancelar
                    </Button>
                    <Button
                        type="submit"
                        form="user-edit-form"
                        loading={updateMutation.isPending}
                        loadingText="Guardando..."
                        icon={<FloppyDiskIcon />}
                        disabled={isPending()}
                    >
                        Guardar
                    </Button>
                </>
            }
        >
            <Show
                when={!userQuery.isLoading}
                fallback={
                    <div class="space-y-4 py-4">
                        <SkeletonLoader type="text" count={3} />
                        <SkeletonLoader type="text" count={2} />
                    </div>
                }
            >
                <Show
                    when={userQuery.data}
                    keyed
                    fallback={
                        <div class="flex-col items-center justify-center py-12 text-center">
                            <InfoIcon class="size-10 text-muted/30 mb-3" />
                            <p class="text-muted text-sm">No se encontró el usuario</p>
                        </div>
                    }
                >
                    {(user) => (
                        <UserEditForm
                            formId="user-edit-form"
                            defaultValues={{
                                username: user.username,
                                email: user.email,
                                isActive: user.isActive ?? true,
                                roleIds: user.roles?.map((r: { id: number }) => r.id) ?? [],
                                entityId: user.entityId ?? null,
                            }}
                            roles={rolesQuery.data ?? []}
                            rolesLoading={rolesQuery.isPending}
                            initialEntity={user.entity}
                            isGlobalUser={user.isGlobalUser}
                            onSubmit={handleSubmit}
                            isSubmitting={isPending()}
                        />
                    )}
                </Show>
            </Show>
        </Sheet>
    );
};

export default UserEditSheet;
