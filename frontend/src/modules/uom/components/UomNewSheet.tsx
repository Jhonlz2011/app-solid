import { Component, createSignal } from 'solid-js';
import { createForm } from '@tanstack/solid-form';
import { valibotValidator } from '@tanstack/valibot-form-adapter';
import { UomFormSchema, type UomFormData } from '@app/schema/frontend';
import { useSheetNavigation } from '@shared/hooks/useSheetNavigation';
import { toast } from 'solid-sonner';
import { useCreateUom } from '../data/uom.mutations';
import { FloppyDiskIcon } from '@shared/ui/icons';
import Sheet from '@shared/ui/Sheet';
import Button from '@shared/ui/Button';
import UomForm from './UomForm';

interface UomNewSheetProps { onClose?: () => void; }

const UomNewSheet: Component<UomNewSheetProps> = (props) => {
    const { bindDismiss, close, navigateAway } = useSheetNavigation(props);
    const createMut = useCreateUom();
    const [hasAttemptedSubmit, setHasAttemptedSubmit] = createSignal(false);

    const form = createForm(() => ({
        defaultValues: { code: '', name: '', uom_group: 'CANTIDAD', base_factor: '1' } as UomFormData,
        validatorAdapter: valibotValidator(),
        validators: { onChange: UomFormSchema, onSubmit: UomFormSchema },
        onSubmit: async ({ value }) => {
            createMut.mutate(
                { code: value.code.toUpperCase(), name: value.name, uom_group: value.uom_group, base_factor: value.base_factor ? String(value.base_factor).replace(',', '.') : undefined },
                {
                    onSuccess: () => { toast.success('Unidad creada correctamente'); navigateAway(); },
                    onError: (err: any) => toast.error(err.message || 'Error al crear unidad'),
                },
            );
        },
    }));

    const handleSubmit = () => { setHasAttemptedSubmit(true); form.handleSubmit(); };

    return (
        <Sheet
            bindDismiss={bindDismiss} isOpen={true} onClose={navigateAway}
            title="Nueva Unidad de Medida" description="Registra una nueva unidad estandarizada" size="md"
            footer={
                <>
                    <Button variant="outline" onClick={close} disabled={createMut.isPending}>Cancelar</Button>
                    <Button type="submit" form="uom-form" loading={createMut.isPending} loadingText="Creando..." icon={<FloppyDiskIcon />} onClick={handleSubmit}>
                        Crear Unidad
                    </Button>
                </>
            }
        >
            <UomForm
                form={form}
                formId="uom-form"
                hasAttemptedSubmit={hasAttemptedSubmit}
                codePlaceholder="UND, KG, M..."
            />
        </Sheet>
    );
};

export default UomNewSheet;
