import { Component, createSignal } from 'solid-js';
import { TextField } from '@kobalte/core';
import { createMutation, useQueryClient } from '@tanstack/solid-query';
import { toast } from 'solid-sonner';
import { productsApi } from '../data/products.api';
import { brandKeys } from '../data/products.keys';
import type { Brand } from '../models/products.type';
import { FormDialog } from '@shared/components/ui/FormDialog';

interface CreateBrandDialogProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: (brand: Brand) => void;
}

const CreateBrandDialog: Component<CreateBrandDialogProps> = (props) => {
    const queryClient = useQueryClient();
    const [name, setName] = createSignal('');
    const [website, setWebsite] = createSignal('');

    const mutation = createMutation(() => ({
        mutationFn: (data: { name: string; website?: string }) =>
            productsApi.createBrand(data),
        onSuccess: (newBrand) => {
            toast.success('Marca creada correctamente');
            queryClient.invalidateQueries({ queryKey: brandKeys.list() });
            props.onSuccess(newBrand);
            resetForm();
            props.onClose();
        },
        onError: (error: Error) => {
            toast.error(`Error: ${error.message}`);
        },
    }));

    const resetForm = () => {
        setName('');
        setWebsite('');
    };

    const handleSubmit = (e: Event) => {
        e.preventDefault();
        if (!name().trim()) {
            toast.error('El nombre es requerido');
            return;
        }
        mutation.mutate({
            name: name().trim(),
            website: website() || undefined,
        });
    };

    return (
        <FormDialog
            isOpen={props.isOpen}
            onClose={props.onClose}
            title="Nueva Marca"
            onSubmit={handleSubmit}
            submitLabel={mutation.isPending ? 'Creando...' : 'Crear Marca'}
            isLoading={mutation.isPending}
        >
            <TextField.Root
                value={name()}
                onChange={setName}
                class="text-field-root"
            >
                <TextField.Label class="text-field-label">Nombre *</TextField.Label>
                <TextField.Input class="text-field-input" placeholder="Ej: Stanley, DeWalt" required />
            </TextField.Root>

            <TextField.Root
                value={website()}
                onChange={setWebsite}
                class="text-field-root"
            >
                <TextField.Label class="text-field-label">Sitio Web</TextField.Label>
                <TextField.Input type="url" class="text-field-input" placeholder="https://www.ejemplo.com" />
            </TextField.Root>
        </FormDialog>
    );
};

export default CreateBrandDialog;
