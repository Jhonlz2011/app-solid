import { Component, createSignal, createMemo } from 'solid-js';
import { createForm } from '@tanstack/solid-form';
import { UserUpdateSchema, type UserUpdateData } from '@app/schema/frontend';
import type { RoleType } from '@app/schema/dto';
import { TextField } from '@form/TextField';
import { EntitySelect } from '@shared/ui/selectors';
import Switch from '@/shared/ui/form/Switch';
import { FormSubmissionContext } from '@shared/ui/form/form.types';
import { handleFormApiErrors } from '@shared/utils/form.utils';
import { UserRolePicker } from './shared/UserRolePicker';
import { UserPasswordResetSection } from './shared/UserPasswordResetSection';

export interface UserEditFormProps {
    formId?: string;
    defaultValues: UserUpdateData;
    roles: RoleType[];
    rolesLoading?: boolean;
    initialEntity?: { id: string; businessName: string; taxId: string } | null;
    onSubmit: (values: UserUpdateData & { newPassword?: string }) => void | Promise<void>;
    isSubmitting?: boolean;
}

export const UserEditForm: Component<UserEditFormProps> = (props) => {
    const [hasAttemptedSubmit, setHasAttemptedSubmit] = createSignal(false);
    const [newPassword, setNewPassword] = createSignal('');

    const form = createForm(() => ({
        defaultValues: {
            username: props.defaultValues.username,
            email: props.defaultValues.email,
            isActive: props.defaultValues.isActive ?? true,
            roleIds: props.defaultValues.roleIds ?? [],
            entityId: props.defaultValues.entityId ?? null,
        } as UserUpdateData,
        validators: {
            onChange: UserUpdateSchema,
            onSubmit: UserUpdateSchema,
        },
        onSubmit: async ({ value }) => {
            try {
                await props.onSubmit({
                    ...value,
                    newPassword: newPassword().length >= 8 ? newPassword() : undefined,
                });
            } catch (err) {
                handleFormApiErrors(form, err, 'Error al actualizar el usuario', props.formId ?? 'user-edit-form');
            }
        },
    }));

    const isActive = form.useStore((s) => s.values.isActive);
    const selectedRoleIds = form.useStore((s) => s.values.roleIds);

    const isUserSuperadmin = createMemo(() => {
        const superRole = props.roles?.find(r => r.name === 'superadmin');
        return superRole ? (selectedRoleIds()?.includes(superRole.id) ?? false) : false;
    });

    return (
        <FormSubmissionContext.Provider value={hasAttemptedSubmit}>
            <form
                id={props.formId ?? 'user-edit-form'}
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
                        Información de acceso
                    </div>

                    <form.Field name="username">
                        {(field) => (
                            <TextField.Root field={field()} disabled={props.isSubmitting}>
                                <TextField.Label>Nombre de usuario *</TextField.Label>
                                <TextField.Input placeholder="ej. juan.perez" autocomplete="username" />
                                <TextField.ErrorMessage />
                            </TextField.Root>
                        )}
                    </form.Field>

                    <form.Field name="email">
                        {(field) => (
                            <TextField.Root field={field()} disabled={props.isSubmitting}>
                                <TextField.Label>Correo electrónico *</TextField.Label>
                                <TextField.Input type="email" placeholder="ej. juan@empresa.com" autocomplete="email" />
                                <TextField.ErrorMessage />
                            </TextField.Root>
                        )}
                    </form.Field>
                </div>

                {/* ═══ Account status toggle ═══ */}
                <div class="flex items-center justify-between p-4 bg-surface/40 rounded-xl border border-border/40">
                    <div class="space-y-0.5">
                        <p class="text-sm font-medium text-text">Estado de la cuenta</p>
                        <p class="text-xs text-muted">
                            {isUserSuperadmin()
                                ? 'El propietario de la empresa no puede ser desactivado'
                                : 'Un usuario inactivo no puede iniciar sesión'}
                        </p>
                    </div>
                    <Switch
                        checked={isUserSuperadmin() ? true : (isActive() ?? true)}
                        onChange={(val) => !isUserSuperadmin() && form.setFieldValue('isActive', val)}
                        disabled={props.isSubmitting || isUserSuperadmin()}
                    />
                </div>

                {/* ═══ Password change section ═══ */}
                <UserPasswordResetSection
                    newPassword={newPassword}
                    onPasswordChange={setNewPassword}
                    disabled={props.isSubmitting}
                />

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

export default UserEditForm;
