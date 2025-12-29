import { Component, createSignal, createMemo } from 'solid-js';
import { TextField, Select } from '@kobalte/core';
import { createMutation, useQueryClient } from '@tanstack/solid-query';
import { toast } from 'solid-sonner';
import { productsApi } from '../data/products.api';
import { categoryKeys } from '../data/products.keys';
import type { Category } from '../models/products.type';
import { FormDialog } from '@shared/components/ui/FormDialog';
import { CheckIcon, ChevronDownIcon } from '@shared/components/icons';

interface CreateCategoryDialogProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: (category: Category) => void;
    categories: Category[];
}

const CreateCategoryDialog: Component<CreateCategoryDialogProps> = (props) => {
    const queryClient = useQueryClient();
    const [name, setName] = createSignal('');
    const [parentId, setParentId] = createSignal<number | undefined>();
    const [nameTemplate, setNameTemplate] = createSignal('');

    const mutation = createMutation(() => ({
        mutationFn: (data: { name: string; parentId?: number; nameTemplate?: string }) =>
            productsApi.createCategory(data),
        onSuccess: (newCat) => {
            toast.success('Categoría creada correctamente');
            queryClient.invalidateQueries({ queryKey: categoryKeys.list() });
            props.onSuccess(newCat);
            resetForm();
            props.onClose();
        },
        onError: (error: Error) => {
            toast.error(`Error: ${error.message}`);
        },
    }));

    const resetForm = () => {
        setName('');
        setParentId(undefined);
        setNameTemplate('');
    };

    const handleSubmit = (e: Event) => {
        e.preventDefault();
        if (!name().trim()) {
            toast.error('El nombre es requerido');
            return;
        }
        mutation.mutate({
            name: name().trim(),
            parentId: parentId(),
            nameTemplate: nameTemplate() || undefined,
        });
    };

    // Flatten for select
    const flatCategories = createMemo(() => {
        const flat: { value: number; label: string; level: number }[] = [];
        const traverse = (cats: Category[], level = 0) => {
            for (const cat of cats) {
                flat.push({ value: cat.id, label: '—'.repeat(level) + ' ' + cat.name, level });
                if (cat.children) traverse(cat.children, level + 1);
            }
        };
        traverse(props.categories);
        return flat;
    });

    return (
        <FormDialog
            isOpen={props.isOpen}
            onClose={props.onClose}
            title="Nueva Categoría"
            onSubmit={handleSubmit}
            submitLabel={mutation.isPending ? 'Creando...' : 'Crear Categoría'}
            isLoading={mutation.isPending}
        >
            <TextField.Root
                value={name()}
                onChange={setName}
                class="text-field-root"
            >
                <TextField.Label class="text-field-label">Nombre *</TextField.Label>
                <TextField.Input class="text-field-input" placeholder="Ej: Tubería, Herramientas Manuales" required />
            </TextField.Root>

            <Select.Root
                value={flatCategories().find(c => c.value === parentId())}
                onChange={(val) => setParentId(val?.value)}
                options={flatCategories()}
                optionValue="value"
                optionTextValue="label"
                placeholder="Sin padre (raíz)"
                itemComponent={(itemProps) => (
                    <Select.Item item={itemProps.item} class="select-item">
                        <Select.ItemLabel>{itemProps.item.rawValue.label}</Select.ItemLabel>
                        <Select.ItemIndicator>
                            <CheckIcon class="w-4 h-4" />
                        </Select.ItemIndicator>
                    </Select.Item>
                )}
            >
                <div class="flex flex-col gap-1.5">
                    <Select.Label class="text-sm font-medium text-muted ml-1">Categoría Padre</Select.Label>
                    <Select.Trigger class="select-trigger">
                        <Select.Value<any>>{(state) => state.selectedOption()?.label}</Select.Value>
                        <Select.Icon class="text-muted">
                            <ChevronDownIcon class="w-4 h-4" />
                        </Select.Icon>
                    </Select.Trigger>
                    <Select.Portal>
                        <Select.Content class="select-content">
                            <Select.Listbox class="select-listbox" />
                        </Select.Content>
                    </Select.Portal>
                </div>
            </Select.Root>

            <TextField.Root
                value={nameTemplate()}
                onChange={setNameTemplate}
                class="text-field-root"
            >
                <TextField.Label class="text-field-label">Plantilla de Nombre</TextField.Label>
                <TextField.Input class="text-field-input" placeholder="Ej: {marca} {material} {medida}" />
                <div class="text-xs text-muted ml-1">
                    Usa {'{atributo}'} para auto-generar nombres de productos.
                </div>
            </TextField.Root>
        </FormDialog>
    );
};

export default CreateCategoryDialog;
