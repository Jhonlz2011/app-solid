import { Component, createSignal } from 'solid-js';
import { createForm } from '@tanstack/solid-form';
import { valibotValidator } from '@tanstack/valibot-form-adapter';
import { BrandFormSchema, type BrandFormData } from '@app/schema/frontend';
import { useSheetNavigation } from '@shared/hooks/useSheetNavigation';
import { toast } from 'solid-sonner';
import { isNetworkError } from '@shared/utils/api-errors';
import { useCreateBrand } from '../data/brands.mutations';
import { FloppyDiskIcon } from '@shared/ui/icons';
import { FormSubmissionContext } from '@shared/ui/form/form.types';
import TextField from '@shared/ui/TextField';
import Sheet from '@shared/ui/Sheet';
import Button from '@shared/ui/Button';

interface BrandNewSheetProps { onClose?: () => void; }

const BrandNewSheet: Component<BrandNewSheetProps> = (props) => {
    const { bindDismiss, close, navigateAway } = useSheetNavigation(props);
    const createMut = useCreateBrand();
    const [hasAttemptedSubmit, setHasAttemptedSubmit] = createSignal(false);

    const form = createForm(() => ({
        defaultValues: { name: '', website: '' } as BrandFormData,
        validatorAdapter: valibotValidator(),
        validators: { onChange: BrandFormSchema, onSubmit: BrandFormSchema },
        onSubmit: async ({ value }) => {
            createMut.mutate(
                { name: value.name, website: value.website || undefined },
                {
                    onSuccess: () => { toast.success('Marca creada correctamente'); navigateAway(); },
                    onError: (err: any) => {
                        if (isNetworkError(err)) { toast.info('Guardado localmente', { description: 'Se sincronizará automáticamente al recuperar la conexión.', icon: '☁️' }); navigateAway(); return; }
                        toast.error(err.message || 'Error al crear marca');
                    },
                },
            );
        },
    }));

    return (
        <Sheet
            bindDismiss={bindDismiss}
            isOpen={true}
            onClose={navigateAway}
            title="Nueva Marca"
            description="Registra una nueva marca para tus productos"
            size="sm"
            footer={
                <>
                    <Button variant="outline" onClick={close} disabled={createMut.isPending}>Cancelar</Button>
                    <Button type="submit" form="brand-form" loading={createMut.isPending} loadingText="Creando..." icon={<FloppyDiskIcon />}>
                        Crear Marca
                    </Button>
                </>
            }
        >
            <FormSubmissionContext.Provider value={hasAttemptedSubmit}>
                <form id="brand-form" onSubmit={(e) => { e.preventDefault(); setHasAttemptedSubmit(true); form.handleSubmit(); }} class="space-y-5 py-2">
                    <form.Field name="name">
                        {(field) => (
                            <TextField.Root field={field()}>
                                <TextField.Label>Nombre *</TextField.Label>
                                <TextField.Input type="text" placeholder="Truper, Stanley, DeWalt..." />
                                <TextField.ErrorMessage />
                            </TextField.Root>
                        )}
                    </form.Field>
                    <form.Field name="website">
                        {(field) => (
                            <TextField.Root field={field()}>
                                <TextField.Label>Sitio Web</TextField.Label>
                                <TextField.Input type="url" placeholder="https://www.marca.com" />
                                <TextField.ErrorMessage />
                            </TextField.Root>
                        )}
                    </form.Field>
                </form>
            </FormSubmissionContext.Provider>
        </Sheet>
    );
};

export default BrandNewSheet;
