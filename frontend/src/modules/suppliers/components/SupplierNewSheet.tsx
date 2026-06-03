import { Component } from 'solid-js';
import { useSheetNavigation } from '@shared/hooks/useSheetNavigation';
import { toast } from 'solid-sonner';
import { useCreateSupplier } from '../data/suppliers.mutations';
import { EntityForm } from '@shared/forms/entity';
import type { EntityFormData } from '@app/schema/frontend';
import { ApiError, isNetworkError } from '@shared/utils/api-errors';
import { FloppyDiskIcon } from '@shared/ui/icons';
import Sheet from '@shared/ui/Sheet';
import Button from '@shared/ui/Button';

interface SupplierNewSheetProps {
    onClose?: () => void;
}

const SupplierNewSheet: Component<SupplierNewSheetProps> = (props) => {
    const { bindDismiss, close, navigateAway } = useSheetNavigation(props);
    const createMutation = useCreateSupplier();

    const handleSubmit = async (data: EntityFormData) => {
        try {
            await createMutation.mutateAsync(data);
            toast.success('Proveedor creado correctamente');
        } catch (error: any) {
            if (isNetworkError(error)) {
                toast.info('Guardado localmente', { description: 'Se sincronizará automáticamente al recuperar la conexión.', icon: '☁️' });
                navigateAway();
                return;
            }
            const hasFieldErrors = error instanceof ApiError && (error.errors?.length ?? 0) > 0;
            if (!hasFieldErrors) toast.error(error?.message || 'Error al crear proveedor');
            throw error;
        }
    };

    return (
        <Sheet
            bindDismiss={bindDismiss}
            isOpen={true}
            onClose={navigateAway}
            title="Nuevo Proveedor"
            description="Ingresa los datos del nuevo proveedor"
            size="xxxxl"
            footer={
                <>
                    <Button variant="outline" type="button" onClick={close} disabled={createMutation.isPending}>
                        Cancelar
                    </Button>
                    <Button
                        type="submit"
                        form="entity-form"
                        loading={createMutation.isPending}
                        loadingText="Creando..."
                        icon={<FloppyDiskIcon />}
                    >
                        Crear Proveedor
                    </Button>
                </>
            }
        >
            <EntityForm
                onSubmit={handleSubmit}
                isSubmitting={createMutation.isPending}
                lockedRoles={{ isSupplier: true }}
            />
        </Sheet>
    );
};

export default SupplierNewSheet;

