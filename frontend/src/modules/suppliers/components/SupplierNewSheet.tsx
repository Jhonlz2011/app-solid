import { Component } from 'solid-js';
import { useNavigate } from '@tanstack/solid-router';
import { toast } from 'solid-sonner';
import { useCreateSupplier } from '../data/suppliers.api';
import { SupplierForm } from './SupplierForm';
import type { SupplierFormData } from '@app/schema/frontend';
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

    const handleSubmit = async (data: SupplierFormData) => {
        try {
            await createMutation.mutateAsync(data);
            toast.success('Proveedor creado correctamente');
            handleClose();
        } catch (error: any) {
            // Show toast only for non-field errors; field errors are mapped by SupplierForm
            const hasFieldErrors = error instanceof ApiError && (error.errors?.length ?? 0) > 0;
            if (!hasFieldErrors) {
                toast.error(error?.message || 'Error al crear proveedor');
            }
            throw error; // Re-throw so SupplierForm can map field errors
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
                        form="supplier-form"
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
            <SupplierForm
                onSubmit={handleSubmit}
                isSubmitting={createMutation.isPending}
            />
        </Sheet>
    );
};

export default SupplierNewSheet;
