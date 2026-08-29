import { Component } from 'solid-js';
import type { UomFormData } from '@app/schema/frontend';
import { useSheetNavigation } from '@shared/hooks/useSheetNavigation';
import { executeFormMutation } from '@shared/utils/form.utils';
import { useCreateUom } from '../data/uom.mutations';
import { FloppyDiskIcon } from '@icons/FloppyDiskIcon';
import Sheet from '@overlay/Sheet';
import Button from '@form/Button';
import { UomForm } from './UomForm';

interface UomNewSheetProps {
    onClose?: () => void;
}

const UomNewSheet: Component<UomNewSheetProps> = (props) => {
    const { bindDismiss, close, navigateAway } = useSheetNavigation(props);
    const createMut = useCreateUom();

    const handleSubmit = (values: UomFormData) =>
        executeFormMutation({
            mutation: createMut,
            variables: {
                code: values.code.toUpperCase(),
                name: values.name,
                uom_group: values.uom_group,
                base_factor: values.base_factor ? String(values.base_factor).replace(',', '.') : undefined,
            },
            successMessage: 'Unidad creada correctamente',
            onComplete: navigateAway,
        });

    return (
        <Sheet
            bindDismiss={bindDismiss}
            isOpen={true}
            onClose={navigateAway}
            title="Nueva Unidad de Medida"
            description="Registra una nueva unidad estandarizada"
            size="md"
            footer={
                <>
                    <Button variant="outline" onClick={close} disabled={createMut.isPending}>
                        Cancelar
                    </Button>
                    <Button
                        type="submit"
                        form="uom-new-form"
                        loading={createMut.isPending}
                        loadingText="Creando..."
                        icon={<FloppyDiskIcon />}
                    >
                        Crear Unidad
                    </Button>
                </>
            }
        >
            <UomForm
                formId="uom-new-form"
                onSubmit={handleSubmit}
                isSubmitting={createMut.isPending}
            />
        </Sheet>
    );
};

export default UomNewSheet;
