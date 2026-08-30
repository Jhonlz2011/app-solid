import { Component } from 'solid-js';
import { useSheetNavigation } from '@shared/hooks/useSheetNavigation';
import { executeFormMutation } from '@shared/utils/form.utils';
import type { UserCreateData } from '@app/schema/frontend';
import Sheet from '@overlay/Sheet';
import Button from '@form/Button';
import { FloppyDiskIcon } from '@icons/FloppyDiskIcon';
import { useRoles } from '../data/users.queries';
import { useCreateUser, useSetUserEntity } from '../data/users.mutations';
import { UserCreateForm } from './UserCreateForm';

interface UserNewSheetProps {
    onClose?: () => void;
}

const UserNewSheet: Component<UserNewSheetProps> = (props) => {
    const { bindDismiss, close, navigateAway } = useSheetNavigation(props);
    const createMutation = useCreateUser();
    const rolesQuery = useRoles();
    const setEntityMutation = useSetUserEntity();

    const handleSubmit = async (values: UserCreateData) => {
        const created = await executeFormMutation({
            mutation: createMutation,
            variables: {
                email: values.email,
                username: values.username || undefined,
                password: values.password || undefined,
                roleIds: values.roleIds.length > 0 ? values.roleIds : undefined,
                entityId: values.entityId || undefined,
            },
            successMessage: `Usuario "${values.username || values.email}" configurado correctamente`,
            onComplete: close,
        });

        // Assign entity if selected
        if (values.entityId && created?.id) {
            await setEntityMutation.mutateAsync({
                userId: created.id,
                entityId: values.entityId,
            });
        }
    };

    const isPending = () => createMutation.isPending || setEntityMutation.isPending;

    return (
        <Sheet
            bindDismiss={bindDismiss}
            isOpen={true}
            onClose={navigateAway}
            title="Crear usuario"
            description="Invita o añade un colaborador a tu espacio de trabajo"
            size="lg"
            footer={
                <>
                    <Button variant="outline" onClick={close} disabled={isPending()}>
                        Cancelar
                    </Button>
                    <Button
                        type="submit"
                        form="user-create-form"
                        loading={isPending()}
                        loadingText="Guardando..."
                        icon={<FloppyDiskIcon />}
                    >
                        Guardar / Invitar
                    </Button>
                </>
            }
        >
            <UserCreateForm
                formId="user-create-form"
                roles={rolesQuery.data ?? []}
                rolesLoading={rolesQuery.isPending}
                onSubmit={handleSubmit}
                isSubmitting={isPending()}
            />
        </Sheet>
    );
};

export default UserNewSheet;
