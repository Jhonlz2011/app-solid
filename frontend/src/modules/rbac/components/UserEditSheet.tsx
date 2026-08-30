import { Component, Show } from 'solid-js';
import { useParams } from '@tanstack/solid-router';
import { useSheetNavigation } from '@shared/hooks/useSheetNavigation';
import { toast } from 'solid-sonner';
import type { UserUpdateData } from '@app/schema/frontend';
import Sheet from '@overlay/Sheet';
import Button from '@form/Button';
import { FloppyDiskIcon } from '@icons/FloppyDiskIcon';
import { SkeletonLoader } from '@display/SkeletonLoader';
import { useUser, useRoles } from '../data/users.queries';
import {
    useUpdateUser, useAssignUserRoles,
    useSetUserEntity, useAdminResetPassword,
} from '../data/users.mutations';
import { UserEditForm } from './UserEditForm';

interface UserEditSheetProps {
    userId?: string;
    onClose?: () => void;
}

const UserEditSheet: Component<UserEditSheetProps> = (props) => {
    const params = useParams({ strict: false }) as () => { userId?: string };
    const { bindDismiss, close, navigateAway } = useSheetNavigation(props);
    const userId = () => props.userId ?? params()?.userId;

    const userQuery = useUser(userId);
    const rolesQuery = useRoles();
    const updateMutation = useUpdateUser();
    const assignRolesMutation = useAssignUserRoles();
    const setEntityMutation = useSetUserEntity();
    const resetPwMutation = useAdminResetPassword();

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

    const isPending = () =>
        updateMutation.isPending || assignRolesMutation.isPending ||
        setEntityMutation.isPending || resetPwMutation.isPending;

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
                    <Button variant="outline" onClick={close} disabled={isPending()}>
                        Cancelar
                    </Button>
                    <Button
                        type="submit"
                        form="user-edit-form"
                        loading={isPending()}
                        loadingText="Guardando..."
                        icon={<FloppyDiskIcon />}
                    >
                        Guardar Cambios
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
                    fallback={
                        <div class="flex flex-col items-center justify-center py-12 text-center">
                            <div class="text-4xl mb-4 opacity-50">📭</div>
                            <p class="text-muted">No se encontró el usuario</p>
                        </div>
                    }
                >
                    {(user) => (
                        <UserEditForm
                            formId="user-edit-form"
                            defaultValues={{
                                username: user().username,
                                email: user().email,
                                isActive: user().isActive ?? true,
                                roleIds: user().roles?.map((r: { id: number }) => r.id) ?? [],
                                entityId: user().entityId ?? null,
                            }}
                            roles={rolesQuery.data ?? []}
                            rolesLoading={rolesQuery.isPending}
                            initialEntity={user().entity}
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
