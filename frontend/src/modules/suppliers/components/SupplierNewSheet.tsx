import { Component } from 'solid-js';
import { useNavigate } from '@tanstack/solid-router';
import { toast } from 'solid-sonner';
import { useCreateSupplier } from '../data/suppliers.api';
import { SupplierForm } from './SupplierForm';
import type { SupplierPayload } from '../models/supplier.types';
import Sheet from '@shared/ui/Sheet';

const SupplierNewSheet: Component = () => {
    const navigate = useNavigate();
    const createMutation = useCreateSupplier();

    const handleClose = () => {
        navigate({ to: '/suppliers' });
    };

    const handleSubmit = async (data: SupplierPayload) => {
        try {
            await createMutation.mutateAsync(data);
            toast.success('Proveedor creado correctamente');
            handleClose();
        } catch (error: any) {
            toast.error(error.message || 'Error al crear proveedor');
        }
    };

    return (
        <Sheet
            isOpen={true}
            onClose={handleClose}
            title="Nuevo Proveedor"
            description="Ingresa los datos del nuevo proveedor"
            size="lg"
        >
            <SupplierForm
                onSubmit={handleSubmit}
                isSubmitting={createMutation.isPending}
                onCancel={handleClose}
            />
        </Sheet>
    );
};

export default SupplierNewSheet;
