import { Component } from 'solid-js';
import { useNavigate } from '@tanstack/solid-router';
import { toast } from 'solid-sonner';
import { useCreateSupplier } from '../data/suppliers.api';
import { EntityForm } from '@shared/forms/entity';
import type { EntityFormData } from '@app/schema/frontend';
import { ApiError } from '@shared/utils/api-errors';
import { FloppyDiskIcon } from '@shared/ui/icons';
import Sheet from '@shared/ui/Sheet';
import Button from '@shared/ui/Button';

const SupplierNewSheet: Component = () => {
    const navigate = useNavigate();
    const createMutation = useCreateSupplier();
    const handleClose = () => {
        navigate({ to: '/suppliers' });
    };

    const handleSubmit = async (data: EntityFormData) => {
        try {
            await createMutation.mutateAsync(data);
            toast.success('Proveedor creado correctamente');
            handleClose();
        } catch (error: any) {
            const hasFieldErrors = error instanceof ApiError && (error.errors?.length ?? 0) > 0;
            if (!hasFieldErrors) toast.error(error?.message || 'Error al crear proveedor');
            throw error;
        }
    };

    return (
        <Sheet
            isOpen={true}
            onClose={handleClose}
            title="Nuevo Proveedor"
            description="Ingresa los datos del nuevo proveedor"
            size="xxxxl"
            footer={
                <>
                    <Button variant="outline" type="button" onClick={handleClose} disabled={createMutation.isPending}>
                        Cancelar
                    </Button>
                    <Button
                        type="submit"
                        form="entity-form"
                        loading={createMutation.isPending}
                        loadingText="Creando..."
                        class="min-w-[200px]"
                        icon={<FloppyDiskIcon />}
                    >
                        Crear Proveedor
                    </Button>
                </>
            }
        >
            <EntityForm
                onSubmit={handleSubmit}
                isSubmitting={createMutation.isPending}
                lockedRoles={{ isSupplier: true }}
            />
        </Sheet>
    );
};

export default SupplierNewSheet;

