import { Component, createSignal } from 'solid-js';
import { createForm } from '@tanstack/solid-form';
import { valibotValidator } from '@tanstack/valibot-form-adapter';
import { FamilyFormSchema, type FamilyFormData } from '@app/schema/frontend';
import { useSheetNavigation } from '@shared/hooks/useSheetNavigation';
import { toast } from 'solid-sonner';
import { useCreateFamily } from '../../data/families.mutations';
import { useCategoriesFlat } from '@/modules/categories/data/categories.queries';
import { FloppyDiskIcon } from '@shared/ui/icons';
import { FormSubmissionContext } from '@shared/ui/form/form.types';
import { CategorySelect } from '@shared/ui/selectors';
import TextField from '@shared/ui/TextField';
import Sheet from '@shared/ui/Sheet';
import Button from '@shared/ui/Button';

interface FamilyNewSheetProps { onClose?: () => void; }

const FamilyNewSheet: Component<FamilyNewSheetProps> = (props) => {
    const { bindDismiss, close, navigateAway } = useSheetNavigation(props);
    const createMut = useCreateFamily();
    const [hasAttemptedSubmit, setHasAttemptedSubmit] = createSignal(false);

    const form = createForm(() => ({
        defaultValues: { name: '', categoryId: null, description: '' } as FamilyFormData,
        validatorAdapter: valibotValidator(),
        validators: { onChange: FamilyFormSchema, onSubmit: FamilyFormSchema },
        onSubmit: async ({ value }) => {
            createMut.mutate(
                { name: value.name, categoryId: value.categoryId || undefined, description: value.description || undefined },
                {
                    onSuccess: () => { toast.success('Familia creada correctamente'); navigateAway(); },
                    onError: (err: any) => toast.error(err.message || 'Error al crear familia'),
                },
            );
        },
    }));

    return (
        <Sheet
            bindDismiss={bindDismiss} isOpen={true} onClose={navigateAway}
            title="Nueva Familia" description="Crea una nueva familia de productos" size="md"
            footer={
                <>
                    <Button variant="outline" onClick={close} disabled={createMut.isPending}>Cancelar</Button>
                    <Button type="submit" form="family-form" loading={createMut.isPending} loadingText="Creando..." icon={<FloppyDiskIcon />}>
                        Crear Familia
                    </Button>
                </>
            }
        >
            <FormSubmissionContext.Provider value={hasAttemptedSubmit}>
                <form id="family-form" onSubmit={(e) => { e.preventDefault(); setHasAttemptedSubmit(true); form.handleSubmit(); }} class="space-y-5 py-2">
                    <form.Field name="name">
                        {(field) => (
                            <TextField.Root field={field()}>
                                <TextField.Label>Nombre *</TextField.Label>
                                <TextField.Input type="text" placeholder="Tornillería, Pintura, Herramientas..." />
                                <TextField.ErrorMessage />
                            </TextField.Root>
                        )}
                    </form.Field>
                    <CategorySelect
                        value={form.getFieldValue('categoryId') ?? null}
                        onChange={(id) => form.setFieldValue('categoryId', id)}
                        label="Categoría (opcional)"
                    />
                    <form.Field name="description">
                        {(field) => (
                            <TextField.Root field={field()}>
                                <TextField.Label>Descripción</TextField.Label>
                                <TextField.TextArea rows={2} placeholder="Descripción opcional..." />
                                <TextField.ErrorMessage />
                            </TextField.Root>
                        )}
                    </form.Field>
                </form>
            </FormSubmissionContext.Provider>
        </Sheet>
    );
};

export default FamilyNewSheet;
