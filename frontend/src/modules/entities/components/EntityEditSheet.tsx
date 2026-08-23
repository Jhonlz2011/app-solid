/**
 * EntityEditSheet.tsx — Generic edit sheet for any Entity (Clients, Suppliers, Employees, Carriers).
 */
import { Component, Show } from 'solid-js';
import { useParams, useLocation } from '@tanstack/solid-router';
import { useSheetNavigation } from '@shared/hooks/useSheetNavigation';
import { toast } from 'solid-sonner';
import { EntityForm } from '@shared/forms/entity';
import type { EntityFormData } from '@app/schema/frontend';
import { ApiError, isNetworkError } from '@shared/utils/api-errors';
import { isOffline, showOfflineSavedToast } from '@shared/utils/offline-submit';
import { SkeletonLoader } from '@display/SkeletonLoader';
import Sheet from '@overlay/Sheet';
import Button from '@form/Button';
import { FloppyDiskIcon } from '@icons/FloppyDiskIcon';
import { useClient } from '@modules/clients/data/clients.queries';
import { useSupplier } from '@modules/suppliers/data/suppliers.queries';
import { useEmployee } from '@modules/employees/data/employees.queries';
import { clientMutations } from '@modules/clients/data/clients.mutations';
import { supplierMutations } from '@modules/suppliers/data/suppliers.mutations';
import { employeeMutations } from '@modules/employees/data/employees.mutations';
import type { EntityModuleType } from './EntityNewSheet';

export interface EntityEditSheetProps {
    id?: string | number;
    clientId?: string | number;
    supplierId?: string | number;
    employeeId?: string | number;
    type?: EntityModuleType;
    onClose?: () => void;
}

export const EntityEditSheet: Component<EntityEditSheetProps> = (props) => {
    const params = useParams({ strict: false }) as () => any;
    const location = useLocation();
    const nav = useSheetNavigation(props);

    const resolvedType = (): EntityModuleType => {
        if (props.type) return props.type;
        const pathname = location().pathname;
        if (pathname.includes('/suppliers')) return 'supplier';
        if (pathname.includes('/employees')) return 'employee';
        if (pathname.includes('/carriers')) return 'carrier';
        return 'client';
    };

    const entityId = () => {
        if (props.id) return String(props.id);
        if (props.clientId) return String(props.clientId);
        if (props.supplierId) return String(props.supplierId);
        if (props.employeeId) return String(props.employeeId);
        const p = params();
        const raw = p?.id ?? p?.clientId ?? p?.supplierId ?? p?.employeeId;
        return raw ? String(raw) : '';
    };

    const clientQuery = useClient(entityId, () => resolvedType() === 'client');
    const supplierQuery = useSupplier(entityId, () => resolvedType() === 'supplier');
    const employeeQuery = useEmployee(entityId, () => resolvedType() === 'employee' || resolvedType() === 'carrier');

    const activeQuery = () => {
        const t = resolvedType();
        if (t === 'supplier') return supplierQuery;
        if (t === 'employee' || t === 'carrier') return employeeQuery;
        return clientQuery;
    };

    const updateClient = clientMutations.useUpdate();
    const updateSupplier = supplierMutations.useUpdate();
    const updateEmployee = employeeMutations.useUpdate();

    const activeMutation = () => {
        const t = resolvedType();
        if (t === 'supplier') return updateSupplier;
        if (t === 'employee') return updateEmployee;
        return updateClient;
    };

    const typeConfig = () => {
        const t = resolvedType();
        switch (t) {
            case 'supplier':
                return {
                    title: 'Editar Proveedor',
                    description: 'Modifica los datos del proveedor',
                    btnText: 'Guardar Cambios',
                    successMsg: 'Proveedor actualizado correctamente',
                    errorMsg: 'Error al editar proveedor',
                    notFoundMsg: 'No se encontró el proveedor',
                    lockedRoles: { isSupplier: true },
                };
            case 'employee':
                return {
                    title: 'Editar Empleado',
                    description: 'Modifica los datos del empleado',
                    btnText: 'Guardar Cambios',
                    successMsg: 'Empleado actualizado correctamente',
                    errorMsg: 'Error al editar empleado',
                    notFoundMsg: 'No se encontró el empleado',
                    lockedRoles: { isEmployee: true },
                };
            case 'carrier':
                return {
                    title: 'Editar Transportista',
                    description: 'Modifica los datos del transportista',
                    btnText: 'Guardar Cambios',
                    successMsg: 'Transportista actualizado correctamente',
                    errorMsg: 'Error al editar transportista',
                    notFoundMsg: 'No se encontró el transportista',
                    lockedRoles: { isCarrier: true },
                };
            case 'client':
            default:
                return {
                    title: 'Editar Cliente',
                    description: 'Modifica los datos del cliente',
                    btnText: 'Guardar Cambios',
                    successMsg: 'Cliente actualizado correctamente',
                    errorMsg: 'Error al editar cliente',
                    notFoundMsg: 'No se encontró el cliente',
                    lockedRoles: { isClient: true },
                };
        }
    };

    const handleSubmit = async (data: EntityFormData) => {
        const id = entityId();
        if (!id) return;
        const { taxId, taxIdType, ...updateData } = data;
        const mutation = activeMutation();
        const config = typeConfig();

        if (isOffline()) {
            mutation.mutate({ id, data: updateData });
            showOfflineSavedToast();
            nav.navigateAway();
            return;
        }

        try {
            await mutation.mutateAsync({ id, data: updateData });
            toast.success(config.successMsg);
            nav.close();
        } catch (error: any) {
            if (isNetworkError(error)) {
                toast.info('Guardado localmente', {
                    description: 'Se sincronizará automáticamente al recuperar la conexión.',
                    icon: '☁️',
                });
                nav.close();
                return;
            }
            const hasFieldErrors = error instanceof ApiError && (error.errors?.length ?? 0) > 0;
            if (!hasFieldErrors) toast.error(error?.message || config.errorMsg);
            throw error;
        }
    };

    const query = () => activeQuery();
    const isPending = () => activeMutation().isPending;

    return (
        <Sheet
            bindDismiss={nav.bindDismiss}
            isOpen={true}
            onClose={nav.navigateAway}
            title={typeConfig().title}
            description={typeConfig().description}
            size="xxxxl"
            footer={
                <>
                    <Button variant="outline" type="button" onClick={nav.close} disabled={isPending()}>
                        Cancelar
                    </Button>
                    <Button
                        type="submit"
                        form="entity-form"
                        loading={isPending()}
                        loadingText="Guardando..."
                        icon={<FloppyDiskIcon />}
                    >
                        {typeConfig().btnText}
                    </Button>
                </>
            }
        >
            <Show
                when={Boolean(entityId())}
                fallback={
                    <div class="flex flex-col items-center justify-center py-12 text-center">
                        <div class="text-4xl mb-4">🔍</div>
                        <p class="text-muted">ID de registro inválido</p>
                        <p class="text-sm text-muted/70 mt-1">Verifica la URL e intenta de nuevo</p>
                    </div>
                }
            >
                <Show
                    when={!query().isLoading}
                    fallback={
                        <div class="space-y-6 p-2">
                            <SkeletonLoader type="text" count={2} />
                            <SkeletonLoader type="text" count={3} />
                            <SkeletonLoader type="text" count={2} />
                        </div>
                    }
                >
                    <Show
                        when={query().data}
                        fallback={
                            <div class="flex flex-col items-center justify-center py-12 text-center">
                                <div class="text-4xl mb-4">📭</div>
                                <p class="text-muted">{typeConfig().notFoundMsg}</p>
                            </div>
                        }
                    >
                        <EntityForm
                            entity={query().data}
                            onSubmit={handleSubmit}
                            isSubmitting={isPending()}
                            lockedRoles={typeConfig().lockedRoles}
                        />
                    </Show>
                </Show>
            </Show>
        </Sheet>
    );
};

export default EntityEditSheet;
