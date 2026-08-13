import { Component, Show } from 'solid-js';
import { useParams } from '@tanstack/solid-router';
import { useSheetNavigation } from '@shared/hooks/useSheetNavigation';
import { toast } from 'solid-sonner';
import { useEmployee } from '../data/employees.queries';
import { useUpdateEmployee } from '../data/employees.mutations';
import { EntityForm } from '@shared/forms/entity';
import type { EntityFormData } from '@app/schema/frontend';
import { ApiError, isNetworkError } from '@shared/utils/api-errors';
import { isOffline, showOfflineSavedToast } from '@shared/utils/offline-submit';
import { SkeletonLoader } from '@shared/ui/SkeletonLoader';
import Sheet from '@shared/ui/Sheet';
import Button from '@shared/ui/Button';
import { FloppyDiskIcon } from '@shared/ui/icons';

interface EmployeeEditSheetProps {
    employeeId?: number;
    onClose?: () => void;

}

const EmployeeEditSheet: Component<EmployeeEditSheetProps> = (props) => {
    const params = useParams({ strict: false }) as () => any;
    const { bindDismiss, close, navigateAway } = useSheetNavigation(props);
    
    const employeeId = () => props.employeeId ?? Number(params()?.employeeId);

    const employeeQuery = useEmployee(employeeId);
    const updateMutation = useUpdateEmployee();

    const handleSubmit = async (data: EntityFormData) => {
        if (employeeId() === 0) return;
        const { taxId, taxIdType, ...updateData } = data;

        if (isOffline()) {
            updateMutation.mutate({ id: employeeId(), data: updateData });
            showOfflineSavedToast();
            navigateAway();
            return;
        }
        try {
            await updateMutation.mutateAsync({ id: employeeId(), data: updateData });
            toast.success('Empleado actualizado correctamente');
            close();
        } catch (error: any) {
            if (isNetworkError(error)) {
                toast.info('Guardado localmente', { description: 'Se sincronizará automáticamente al recuperar la conexión.', icon: '☁️' });
                close();
                return;
            }
            const hasFieldErrors = error instanceof ApiError && (error.errors?.length ?? 0) > 0;
            if (!hasFieldErrors) {
                toast.error(error?.message || 'Error al editar empleado');
            }
            throw error;
        }
    };

    return (
        <Sheet
            bindDismiss={bindDismiss}
            isOpen={true}
            onClose={navigateAway}
            title="Editar Empleado"
            description="Modifica los datos del empleado"
            size="xxxxl"
            footer={
                <>
                    <Button variant="outline" type="button" onClick={close} disabled={updateMutation.isPending}>
                        Cancelar
                    </Button>
                    <Button
                        type="submit"
                        form="entity-form"
                        loading={updateMutation.isPending}
                        loadingText="Guardando..."
                        icon={<FloppyDiskIcon/>}
                    >
                        Guardar Cambios
                    </Button>
                </>
            }
        >
            <Show
                when={employeeId() > 0}
                fallback={
                    <div class="flex flex-col items-center justify-center py-12 text-center">
                        <div class="text-4xl mb-4">🔍</div>
                        <p class="text-muted">ID de empleado inválido</p>
                        <p class="text-sm text-muted/70 mt-1">Verifica la URL e intenta de nuevo</p>
                    </div>
                }
            >
                <Show
                    when={!employeeQuery.isLoading}
                    fallback={
                        <div class="space-y-6 p-2">
                            <SkeletonLoader type="text" count={2} />
                            <SkeletonLoader type="text" count={3} />
                            <SkeletonLoader type="text" count={2} />
                        </div>
                    }
                >
                    <Show
                        when={employeeQuery.data}
                        fallback={
                            <div class="flex flex-col items-center justify-center py-12 text-center">
                                <div class="text-4xl mb-4">📭</div>
                                <p class="text-muted">No se encontró el empleado</p>
                            </div>
                        }
                    >
                        <EntityForm
                            entity={employeeQuery.data}
                            onSubmit={handleSubmit}
                            isSubmitting={updateMutation.isPending}
                            lockedRoles={{ isEmployee: true }}
                        />
                    </Show>
                </Show>
            </Show>
        </Sheet>
    );
};

export default EmployeeEditSheet;
