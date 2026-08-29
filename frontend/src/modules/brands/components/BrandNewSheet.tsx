import { Component } from 'solid-js';
import type { BrandFormData } from '@app/schema/frontend';
import { useSheetNavigation } from '@shared/hooks/useSheetNavigation';
import { executeFormMutation } from '@shared/utils/form.utils';
import { useCreateBrand } from '../data/brands.mutations';
import { FloppyDiskIcon } from '@icons/FloppyDiskIcon';
import Sheet from '@overlay/Sheet';
import Button from '@form/Button';
import { BrandForm } from './BrandForm';

interface BrandNewSheetProps {
    onClose?: () => void;
}

const BrandNewSheet: Component<BrandNewSheetProps> = (props) => {
    const { bindDismiss, close, navigateAway } = useSheetNavigation(props);
    const createMut = useCreateBrand();

    const handleSubmit = (values: BrandFormData) =>
        executeFormMutation({
            mutation: createMut,
            variables: { name: values.name, website: values.website || undefined },
            successMessage: 'Marca creada correctamente',
            onComplete: navigateAway,
        });

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
                    <Button variant="outline" onClick={close} disabled={createMut.isPending}>
                        Cancelar
                    </Button>
                    <Button
                        type="submit"
                        form="brand-new-form"
                        loading={createMut.isPending}
                        loadingText="Creando..."
                        icon={<FloppyDiskIcon />}
                    >
                        Crear Marca
                    </Button>
                </>
            }
        >
            <BrandForm
                formId="brand-new-form"
                onSubmit={handleSubmit}
                isSubmitting={createMut.isPending}
            />
        </Sheet>
    );
};

export default BrandNewSheet;
