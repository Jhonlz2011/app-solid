import { Component, createSignal } from 'solid-js';
import { createForm } from '@tanstack/solid-form';
import { UserUpdateSchema, type UserUpdateData } from '@app/schema/frontend';
import type { RoleType } from '@app/schema/dto';
import { SYSTEM_ROLES } from '@app/schema/enums';
import { FormSectionHeader } from '@form/FormSectionHeader';
import { Switch } from '@form/Switch';
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
    onSubmit: (values: UserUpdateData) => void | Promise<void>;
    isSubmitting?: boolean;
}

export const UserEditForm: Component<UserEditFormProps> = (props) => {
    const [hasAttemptedSubmit, setHasAttemptedSubmit] = createSignal(false);
    const [newPassword, setNewPassword] = createSignal('');

    const isUserSuperadmin = () => {
        const superadminRole = props.roles.find(r => r.name === SYSTEM_ROLES.SUPERADMIN);
        return Boolean(superadminRole && props.defaultValues.roleIds.includes(superadminRole.id));
    };

    const form = createForm(() => ({
        defaultValues: {
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
                await props.onSubmit(value);
            } catch (err) {
                handleFormApiErrors(form, err, 'Error al actualizar el usuario', props.formId ?? 'user-edit-form');
            }
        },
    }));

    const isActive = form.useStore((s) => s.values.isActive);
    const selectedRoleIds = form.useStore((s) => s.values.roleIds);

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
                <div class="space-y-3">
                    <FormSectionHeader
                        title="Identidad de Acceso"
                        indicatorColor="bg-primary"
                    />

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
                            label="Persona vinculada"
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
