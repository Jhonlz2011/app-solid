import { Component, createSignal } from 'solid-js';
import { Outlet } from '@tanstack/solid-router';
import { useSheetNavigation } from '@shared/hooks/useSheetNavigation';
import { executeFormMutation } from '@shared/utils/form.utils';
import type { UserCreateData } from '@app/schema/frontend';
import Sheet from '@overlay/Sheet';
import Button from '@form/Button';
import { FloppyDiskIcon } from '@icons/FloppyDiskIcon';
import { MailIcon } from '@icons/MailIcon';
import { useRoles } from '../data/users.queries';
import { useCreateUser, useSetUserEntity } from '../data/users.mutations';
import { UserCreateForm, type UserCreateFormState } from './UserCreateForm';

interface UserNewSheetProps {
    onClose?: () => void;
}

const UserNewSheet: Component<UserNewSheetProps> = (props) => {
    const { bindDismiss, close, navigateAway } = useSheetNavigation(props);
    const createMutation = useCreateUser();
    const rolesQuery = useRoles();
    const setEntityMutation = useSetUserEntity();

    const [formState, setFormState] = createSignal<UserCreateFormState>({
        mode: 'invite',
        isExistingUser: false,
        isAlreadyMember: false,
        canSubmit: true,
    });

    const isInviteFlow = () => formState().isExistingUser || formState().mode === 'invite';
    const submitButtonLabel = () => (isInviteFlow() ? 'Invitar' : 'Guardar');
    const submitButtonIcon = () => (isInviteFlow() ? <MailIcon class="size-4" /> : <FloppyDiskIcon class="size-4" />);
    const submitLoadingText = () => (isInviteFlow() ? 'Invitando...' : 'Guardando...');

    const handleSubmit = async (values: UserCreateData) => {
        const isInvite = isInviteFlow();
        const created = await executeFormMutation({
            mutation: createMutation,
            variables: values,
            successMessage: isInvite
                ? `Invitación enviada a "${values.email}" correctamente`
                : `Usuario "${values.username || values.email}" creado correctamente`,
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
                        loadingText={submitLoadingText()}
                        icon={submitButtonIcon()}
                        disabled={isPending() || formState().isAlreadyMember}
                    >
                        {submitButtonLabel()}
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
                onStateChange={setFormState}
            />
            {/* Nested role creation dialogs render here */}
            <Outlet />
        </Sheet>
    );
};

export default UserNewSheet;
