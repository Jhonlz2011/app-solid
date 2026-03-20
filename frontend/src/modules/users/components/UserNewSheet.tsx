import { Component, createMemo } from 'solid-js';
import { useNavigate } from '@tanstack/solid-router';
import { toast } from 'solid-sonner';
import Sheet from '@shared/ui/Sheet';
import Button from '@shared/ui/Button';
import { FloppyDiskIcon } from '@shared/ui/icons';
import { useCreateUser, useRoles, useEntitiesList, useSetUserEntity } from '../data/users.api';
import UserForm from './UserForm';
import type { EntityOption } from './UserForm';

const UserNewSheet: Component = () => {
    const navigate = useNavigate();
    const createMutation = useCreateUser();
    const rolesQuery = useRoles();
    const entitiesQuery = useEntitiesList();
    const setEntityMutation = useSetUserEntity();

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
        password?: string;
        roleIds: number[];
        entityId?: number | null;
    }) => {
        if (!values.password) return;
        try {
            const created = await createMutation.mutateAsync({
                username: values.username,
                email: values.email,
                password: values.password,
                roleIds: values.roleIds.length > 0 ? values.roleIds : undefined,
            });

            // Assign entity if selected
            if (values.entityId && created?.id) {
                await setEntityMutation.mutateAsync({
                    userId: created.id,
                    entityId: values.entityId,
                });
            }

            toast.success(`Usuario "${values.username}" creado correctamente`);
            handleClose();
        } catch (err: any) {
            toast.error(err?.message || 'Error al crear usuario');
        }
    };

    const isPending = () => createMutation.isPending || setEntityMutation.isPending;

    return (
        <Sheet
            isOpen={true}
            onClose={handleClose}
            title="Nuevo Usuario"
            description="Crea una cuenta de acceso para un nuevo colaborador"
            size="lg"
            footer={
                <>
                    <Button variant="outline" onClick={handleClose} disabled={isPending()}>
                        Cancelar
                    </Button>
                    <Button
                        type="submit"
                        form="user-form"
                        loading={isPending()}
                        loadingText="Creando..."
                        icon={<FloppyDiskIcon />}
                    >
                        Crear Usuario
                    </Button>
                </>
            }
        >
            <UserForm
                formId="user-form"
                roles={rolesQuery.data ?? []}
                rolesLoading={rolesQuery.isPending}
                showPassword={true}
                showIsActive={false}
                showEntityPicker={true}
                entities={entityOptions()}
                entitiesLoading={entitiesQuery.isPending}
                onSubmit={handleSubmit}
                isSubmitting={isPending()}
            />
        </Sheet>
    );
};

export default UserNewSheet;
