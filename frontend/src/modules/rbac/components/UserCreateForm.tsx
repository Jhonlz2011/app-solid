import { Component, createSignal } from 'solid-js';
import { createForm } from '@tanstack/solid-form';
import { UserCreateSchema, type UserCreateData } from '@app/schema/frontend';
import type { RoleType } from '@app/schema/dto';
import { TextField } from '@form/TextField';
import { EntitySelect } from '@shared/ui/selectors';
import { FormSubmissionContext } from '@shared/ui/form/form.types';
import { handleFormApiErrors } from '@shared/utils/form.utils';
import { UserRolePicker } from './shared/UserRolePicker';

export interface UserCreateFormProps {
    formId?: string;
    roles: RoleType[];
    rolesLoading?: boolean;
    initialEntity?: { id: string; businessName: string; taxId: string } | null;
    onSubmit: (values: UserCreateData) => void | Promise<void>;
    isSubmitting?: boolean;
}

export const UserCreateForm: Component<UserCreateFormProps> = (props) => {
    const [hasAttemptedSubmit, setHasAttemptedSubmit] = createSignal(false);

    const form = createForm(() => ({
        defaultValues: {
            username: '',
            email: '',
            password: '',
            roleIds: [] as number[],
            entityId: null as string | null,
        } as UserCreateData,
        validators: {
            onChange: UserCreateSchema,
            onSubmit: UserCreateSchema,
        },
        onSubmit: async ({ value }) => {
            try {
                await props.onSubmit(value);
            } catch (err) {
                handleFormApiErrors(form, err, 'Error al crear el usuario', props.formId ?? 'user-create-form');
            }
        },
    }));

    const selectedRoleIds = form.useStore((s) => s.values.roleIds);

    return (
        <FormSubmissionContext.Provider value={hasAttemptedSubmit}>
            <form
                id={props.formId ?? 'user-create-form'}
                onSubmit={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setHasAttemptedSubmit(true);
                    form.handleSubmit();
                }}
                class="flex flex-col gap-6 py-4"
            >
                {/* ═══ Basic info ═══ */}
                <div class="space-y-4">
                    <div class="text-xs font-semibold text-muted uppercase tracking-wider flex items-center gap-2">
                        <div class="size-1.5 rounded-full bg-primary" />
                        Identidad del Usuario
                    </div>

                    <form.Field name="email">
                        {(field) => (
                            <TextField.Root field={field()} disabled={props.isSubmitting}>
                                <TextField.Label>Correo electrónico *</TextField.Label>
                                <TextField.Input type="email" placeholder="ej. juan@empresa.com" autocomplete="email" />
                                <TextField.ErrorMessage />
                            </TextField.Root>
                        )}
                    </form.Field>

                    <form.Field name="username">
                        {(field) => (
                            <TextField.Root field={field()} disabled={props.isSubmitting}>
                                <TextField.Label>Nombre de usuario (Opcional)</TextField.Label>
                                <TextField.Input placeholder="Se generará del correo si se deja vacío" autocomplete="username" />
                                <TextField.ErrorMessage />
                            </TextField.Root>
                        )}
                    </form.Field>

                    <form.Field name="password">
                        {(field) => (
                            <TextField.Root field={field()} disabled={props.isSubmitting}>
                                <TextField.Label>Contraseña inicial (Opcional)</TextField.Label>
                                <TextField.PasswordInput placeholder="Mínimo 8 caracteres (para usuarios nuevos)" autocomplete="new-password" />
                                <TextField.ErrorMessage />
                            </TextField.Root>
                        )}
                    </form.Field>
                </div>

                {/* ═══ Entity picker (Employee link) ═══ */}
                <form.Field name="entityId">
                    {(field) => (
                        <EntitySelect
                            value={field().state.value}
                            onChange={(id) => field().handleChange(id)}
                            label="Persona vinculada (Empleado)"
                            placeholder="Buscar empleado por nombre o identificación..."
                            isEmployee={true}
                            disabled={props.isSubmitting}
                            field={field()}
                            initialEntity={props.initialEntity}
                        />
                    )}
                </form.Field>

                {/* ═══ Role selection ═══ */}
                <UserRolePicker
                    roles={props.roles}
                    rolesLoading={props.rolesLoading}
                    selectedRoleIds={selectedRoleIds() ?? []}
                    onChange={(ids) => form.setFieldValue('roleIds', ids)}
                    disabled={props.isSubmitting}
                />
            </form>
        </FormSubmissionContext.Provider>
    );
};

export default UserCreateForm;
