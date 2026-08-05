import { Component, createSignal } from 'solid-js';
import { useAuth } from '@/modules/auth/store/auth.store';
import { useCheckEmployeeReferences } from '../data/employees.queries';
import { useDeleteEmployee, useHardDeleteEmployee } from '../data/employees.mutations';
import type { EmployeeListItem } from '../data/employees.api';
import type { EntityReferences } from '@app/schema/shared-dto';
import DeleteDialog from '@shared/ui/DeleteDialog';

export interface EmployeeDeleteDialogProps {
    employee: EmployeeListItem | null;
    onClose: () => void;
    onSuccess?: () => void;
}

const EmployeeDeleteDialog: Component<EmployeeDeleteDialogProps> = (props) => {
    const auth = useAuth();
    const canDestroy = () => auth.hasPermission('employees.destroy');

    const [mode, setMode] = createSignal<'soft' | 'hard'>('soft');

    const checkEnabled = () => canDestroy() && mode() === 'hard' && props.employee !== null;

    const refsQuery = useCheckEmployeeReferences(
        () => props.employee?.id ?? null,
        checkEnabled
    );
    
    const deactivateMutation = useDeleteEmployee();
    const hardDeleteMutation = useHardDeleteEmployee();

    const isLoading = () => deactivateMutation.isPending || hardDeleteMutation.isPending;
    const hasReferences = () => {
        if (refsQuery.isPending) return false;
        return (refsQuery.data?.total ?? 0) > 0;
    };

    const handleConfirm = (confirmedMode: 'soft' | 'hard') => {
        if (!props.employee) return;
        const id = props.employee.id;
        if (confirmedMode === 'hard') {
            hardDeleteMutation.mutate(id, { onSuccess: () => { props.onSuccess?.(); props.onClose(); } });
        } else {
            deactivateMutation.mutate(id, { onSuccess: () => { props.onSuccess?.(); props.onClose(); } });
        }
    };

    const referenceLines = () => {
        if (refsQuery.isPending) return [];
        const data = refsQuery.data as EntityReferences | undefined;
        if (!data) return [];
        const lines: string[] = [];
        if (data.workOrders > 0) lines.push(`${data.workOrders} orden(es) de trabajo`);
        if (data.invoices > 0) lines.push(`${data.invoices} documento(s) electrónico(s)`);
        return lines;
    };

    return (
        <DeleteDialog
            isOpen={!!props.employee}
            onClose={props.onClose}
            onConfirm={handleConfirm}
            onModeChange={setMode}
            title="Eliminar empleado"
            description={props.employee?.business_name}
            allowHardDelete={canDestroy()}
            isLoading={isLoading()}
            softDeleteTitle="Eliminar"
            softDeleteDesc="El empleado quedará inactivo y podrá restaurarse en cualquier momento."
            hardDeleteTitle="Destruir permanentemente"
            hardDeleteDesc="Se eliminará de forma definitiva sin posibilidad de recuperación."
            
            softLoadingText="Eliminando..."
            hardLoadingText="Destruyendo..."

            isCheckingDependencies={refsQuery.isFetching}
            hasDependencies={hasReferences()}
            dependencyWarnings={referenceLines()}
            preventHardDeleteText="No se puede destruir"
            preventHardDeleteReason="Registros vinculados que lo impiden:"
            preventHardDeleteSuggestion={<>Usa <strong class="text-muted font-semibold">Eliminar</strong> para ocultar al empleado conservando el historial.</>}
        />
    );
};

export default EmployeeDeleteDialog;
