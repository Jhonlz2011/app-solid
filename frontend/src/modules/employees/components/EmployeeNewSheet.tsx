import { Component } from 'solid-js';
import { useSheetNavigation } from '@shared/hooks/useSheetNavigation';
import { toast } from 'solid-sonner';
import { useCreateEmployee } from '../data/employees.mutations';
import { EntityForm } from '@shared/forms/entity';
import type { EntityFormData } from '@app/schema/frontend';
import { ApiError, isNetworkError } from '@shared/utils/api-errors';
import { isOffline, showOfflineSavedToast } from '@shared/utils/offline-submit';
import { FloppyDiskIcon } from '@shared/ui/icons';
import Sheet from '@shared/ui/Sheet';
import Button from '@shared/ui/Button';

interface EmployeeNewSheetProps {
    onClose?: () => void;
}

const EmployeeNewSheet: Component<EmployeeNewSheetProps> = (props) => {
    const { bindDismiss, close, navigateAway } = useSheetNavigation(props);
    const createMutation = useCreateEmployee();

    const handleSubmit = async (data: EntityFormData) => {
        if (isOffline()) {
            createMutation.mutate(data);
            showOfflineSavedToast();
            navigateAway();
            return;
        }
        try {
            await createMutation.mutateAsync(data);
            toast.success('Empleado creado correctamente');
            close();
        } catch (error: any) {
            if (isNetworkError(error)) {
                toast.info('Guardado localmente', { description: 'Se sincronizará automáticamente al recuperar la conexión.', icon: '☁️' });
                close();
                return;
            }
            const hasFieldErrors = error instanceof ApiError && (error.errors?.length ?? 0) > 0;
            if (!hasFieldErrors) toast.error(error?.message || 'Error al crear empleado');
            throw error;
        }
    };

    return (
        <Sheet
            bindDismiss={bindDismiss}
            isOpen={true}
            onClose={navigateAway}
            title="Nuevo Empleado"
            description="Ingresa los datos del nuevo empleado"
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
                        Crear Empleado
                    </Button>
                </>
            }
        >
            <EntityForm
                onSubmit={handleSubmit}
                isSubmitting={createMutation.isPending}
                lockedRoles={{ isEmployee: true }}
            />
        </Sheet>
    );
};

export default EmployeeNewSheet;
