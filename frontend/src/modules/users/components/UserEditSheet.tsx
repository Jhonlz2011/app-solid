import { Component, Show, createMemo } from 'solid-js';
import { useNavigate } from '@tanstack/solid-router';
import { toast } from 'solid-sonner';
import Sheet from '@shared/ui/Sheet';
import Button from '@shared/ui/Button';
import { FloppyDiskIcon } from '@shared/ui/icons';
import { SkeletonLoader } from '@shared/ui/SkeletonLoader';
import {
    useUser, useUpdateUser, useAssignUserRoles, useRoles,
    useSetUserEntity, useEntitiesList, useAdminResetPassword,
} from '../data/users.api';
import UserForm from './UserForm';
import type { EntityOption } from './UserForm';

interface UserEditSheetProps {
    userId: number;
}

const UserEditSheet: Component<UserEditSheetProps> = (props) => {
    const navigate = useNavigate();
    const userQuery = useUser(() => props.userId);
    const rolesQuery = useRoles();
    const entitiesQuery = useEntitiesList();
    const updateMutation = useUpdateUser();
    const assignRolesMutation = useAssignUserRoles();
    const setEntityMutation = useSetUserEntity();
    const resetPwMutation = useAdminResetPassword();

    const handleClose = () => navigate({ to: '/users' });

    const entityOptions = createMemo((): EntityOption[] => {
        const raw = entitiesQuery.data;
        if (!raw || !Array.isArray(raw)) return [];
        return raw.map((e: any) => ({
            id: e.id,
            businessName: e.business_name ?? e.businessName ?? '',
            taxId: e.tax_id ?? e.taxId ?? '',
        }));
    });

    const handleSubmit = async (values: {
        username: string;
        email: string;
        isActive?: boolean;
        roleIds: number[];
        entityId?: number | null;
        newPassword?: string;
    }) => {
        try {
            const promises: Promise<any>[] = [
                updateMutation.mutateAsync({
                    id: props.userId,
                    username: values.username,
                    email: values.email,
                    isActive: values.isActive,
                }),
                assignRolesMutation.mutateAsync({
                    userId: props.userId,
                    roleIds: values.roleIds,
                }),
            ];

            // Entity change
            const currentEntityId = userQuery.data?.entityId ?? null;
            if (values.entityId !== undefined && values.entityId !== currentEntityId) {
                promises.push(
                    setEntityMutation.mutateAsync({
                        userId: props.userId,
                        entityId: values.entityId,
                    })
                );
            }

            // Password reset
            if (values.newPassword) {
                promises.push(
                    resetPwMutation.mutateAsync({
                        userId: props.userId,
                        newPassword: values.newPassword,
                    })
                );
            }

            await Promise.all(promises);

            const msgs = ['Usuario actualizado correctamente'];
            if (values.newPassword) msgs.push('Contraseña restablecida — sesiones cerradas');
            toast.success(msgs.join('. '));
            handleClose();
        } catch (err: any) {
            toast.error(err?.message || 'Error al actualizar usuario');
        }
    };

    const isPending = () =>
        updateMutation.isPending || assignRolesMutation.isPending ||
        setEntityMutation.isPending || resetPwMutation.isPending;

    return (
        <Sheet
            isOpen={true}
            onClose={handleClose}
            title="Editar Usuario"
            description="Modifica los datos de la cuenta"
            size="lg"
            footer={
                <>
                    <Button variant="outline" onClick={handleClose} disabled={isPending()}>
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
                        <UserForm
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
                            showPassword={false}
                            showPasswordChange={true}
                            showIsActive={true}
                            showEntityPicker={true}
                            entities={entityOptions()}
                            entitiesLoading={entitiesQuery.isPending}
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
