import { Component } from 'solid-js';
import { useSheetNavigation } from '@shared/hooks/useSheetNavigation';
import { toast } from 'solid-sonner';
import { useCreateAttribute } from '../data/attributes.mutations';
import AttributeForm from './AttributeForm';
import type { AttributeFormData } from '@app/schema/frontend';
import { ApiError, isNetworkError } from '@shared/utils/api-errors';
import { isOffline, showOfflineSavedToast } from '@shared/utils/offline-submit';
import { FloppyDiskIcon } from '@shared/ui/icons';
import Sheet from '@shared/ui/Sheet';
import Button from '@shared/ui/Button';

interface AttributeNewSheetProps {
    onClose?: () => void;
}

const AttributeNewSheet: Component<AttributeNewSheetProps> = (props) => {
    const { bindDismiss, close, navigateAway } = useSheetNavigation(props);
    const createMutation = useCreateAttribute();

    const handleSubmit = async (data: AttributeFormData) => {
        if (isOffline()) {
            createMutation.mutate(data);
            showOfflineSavedToast();
            navigateAway();
            return;
        }
        try {
            await createMutation.mutateAsync(data);
            toast.success('Atributo creado correctamente');
            navigateAway();
        } catch (error: any) {
            if (isNetworkError(error)) {
                toast.info('Guardado localmente', { description: 'Se sincronizará automáticamente al recuperar la conexión.', icon: '☁️' });
                navigateAway();
                return;
            }
            const hasFieldErrors = error instanceof ApiError && (error.errors?.length ?? 0) > 0;
            if (!hasFieldErrors) toast.error(error?.message || 'Error al crear el atributo');
            throw error;
        }
    };

    return (
        <Sheet
            bindDismiss={bindDismiss}
            isOpen={true}
            onClose={navigateAway}
            title="Nuevo Atributo"
            description="Define un nuevo atributo para clasificar productos (ej: color, talla)"
            size="xl"
            footer={
                <>
                    <Button variant="outline" type="button" onClick={close} disabled={createMutation.isPending}>
                        Cancelar
                    </Button>
                    <Button
                        type="submit"
                        form="attribute-form"
                        loading={createMutation.isPending}
                        loadingText="Creando..."
                        icon={<FloppyDiskIcon />}
                    >
                        Crear Atributo
                    </Button>
                </>
            }
        >
            <AttributeForm
                onSubmit={handleSubmit}
                isSubmitting={createMutation.isPending}
            />
        </Sheet>
    );
};

export default AttributeNewSheet;
