import { Component, createSignal, Show } from 'solid-js';
import { createForm } from '@tanstack/solid-form';
import { safeParse } from 'valibot';
import { UserUpdateSchema, type UserUpdateData } from '@app/schema/frontend';
import type { RoleType } from '@app/schema/dto';
import { FieldLabel } from '@form/TextField';
import { EntitySelect } from '@shared/ui/selectors';
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
    isGlobalUser?: boolean;
    onSubmit: (values: UserUpdateData & { newPassword?: string }) => void | Promise<void>;
    isSubmitting?: boolean;
}

export const UserEditForm: Component<UserEditFormProps> = (props) => {
    const [hasAttemptedSubmit, setHasAttemptedSubmit] = createSignal(false);
    const [newPassword, setNewPassword] = createSignal('');

    const form = createForm(() => ({
        defaultValues: {
            isActive: props.defaultValues.isActive ?? true,
            roleIds: props.defaultValues.roleIds ?? [],
            entityId: props.defaultValues.entityId ?? null,
        } as UserUpdateData,
        validators: {
            onSubmit: ({ value }) => {
                if (!value.roleIds || value.roleIds.length === 0) {
                    return 'El usuario debe tener al menos un rol asignado';
                }
                const parseRes = safeParse(UserUpdateSchema, value);
                if (!parseRes.success) {
                    return parseRes.issues[0]?.message || 'Datos del formulario inválidos';
                }
                return undefined;
            },
        },
        onSubmit: async ({ value }) => {
            try {
                await props.onSubmit({
                    ...value,
                    newPassword: newPassword().trim() || undefined,
                });
            } catch (err) {
                handleFormApiErrors(form, err, 'Error al actualizar el usuario', props.formId ?? 'user-edit-form');
            }
        },
    }));

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
                class="flex flex-col gap-4 py-4"
            >
                {/* ═══ User Identity (Global Read-Only in Tenant RBAC) ═══ */}
                <div class="space-y-2">
                    <FieldLabel tooltip="Identidad de acceso única del colaborador">
                        Identidad de la cuenta
                    </FieldLabel>
                    <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div class="p-3 bg-surface/50 rounded-xl border border-border/60">
                            <p class="text-[10px] font-semibold uppercase tracking-wider text-muted">Nombre de usuario</p>
                            <p class="text-sm font-semibold text-heading truncate mt-0.5">{props.defaultValues.username}</p>
                        </div>

                        <div class="p-3 bg-surface/50 rounded-xl border border-border/60">
                            <p class="text-[10px] font-semibold uppercase tracking-wider text-muted">Correo electrónico</p>
                            <p class="text-sm font-semibold text-heading truncate mt-0.5">{props.defaultValues.email}</p>
                        </div>
                    </div>
                </div>

                {/* ═══ Entity picker (Employee link) ═══ */}
                <form.Field name="entityId">
                    {(field) => (
                        <EntitySelect
                            value={field().state.value}
                            onChange={(id) => field().handleChange(id)}
                            label="Persona vinculada"
                            placeholder="Buscar empleado por nombre o identificación..."
                            isEmployee={true}
                            disabled={props.isSubmitting}
                            field={field()}
                            initialEntity={props.initialEntity}
                        />
                    )}
                </form.Field>

                {/* ═══ Password change section (Only for company-local users) ═══ */}
                <Show when={props.isGlobalUser === false}>
                    <UserPasswordResetSection
                        newPassword={newPassword}
                        onPasswordChange={setNewPassword}
                        disabled={props.isSubmitting}
                    />
                </Show>

                {/* ═══ Role selection ═══ */}
                <form.Field
                    name="roleIds"
                    validators={{
                        onChange: ({ value }) => (!value || value.length === 0) ? 'El usuario debe tener al menos un rol asignado' : undefined,
                        onBlur: ({ value }) => (!value || value.length === 0) ? 'El usuario debe tener al menos un rol asignado' : undefined,
                    }}
                >
                    {(field) => {
                        const hasError = () => (field().state.meta.isTouched || hasAttemptedSubmit()) && (!field().state.value || field().state.value.length === 0);
                        const errorMsg = () => field().state.meta.errors[0] || 'El usuario debe tener al menos un rol asignado';
                        return (
                            <div class="space-y-1">
                                <UserRolePicker
                                    roles={props.roles}
                                    rolesLoading={props.rolesLoading}
                                    selectedRoleIds={field().state.value ?? []}
                                    onChange={(ids) => {
                                        field().handleChange(ids);
                                        field().handleBlur();
                                    }}
                                    disabled={props.isSubmitting}
                                />
                                <Show when={hasError()}>
                                    <p class="text-xs text-danger font-medium mt-1 animate-in fade-in duration-150" role="alert">
                                        {String(errorMsg())}
                                    </p>
                                </Show>
                            </div>
                        );
                    }}
                </form.Field>
            </form>
        </FormSubmissionContext.Provider>
    );
};

export default UserEditForm;
