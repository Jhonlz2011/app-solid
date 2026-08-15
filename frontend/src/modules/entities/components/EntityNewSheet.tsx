/**
 * EntityNewSheet.tsx — Generic creation sheet for any Entity (Clients, Suppliers, Employees, Carriers).
 */
import { Component } from 'solid-js';
import { useLocation } from '@tanstack/solid-router';
import { useSheetNavigation } from '@shared/hooks/useSheetNavigation';
import { toast } from 'solid-sonner';
import { EntityForm } from '@shared/forms/entity';
import type { EntityFormData } from '@app/schema/frontend';
import { ApiError, isNetworkError } from '@shared/utils/api-errors';
import { isOffline, showOfflineSavedToast } from '@shared/utils/offline-submit';
import { FloppyDiskIcon } from '@shared/ui/icons';
import Sheet from '@shared/ui/Sheet';
import Button from '@shared/ui/Button';
import { clientMutations } from '@modules/clients/data/clients.mutations';
import { supplierMutations } from '@modules/suppliers/data/suppliers.mutations';
import { employeeMutations } from '@modules/employees/data/employees.mutations';

export type EntityModuleType = 'client' | 'supplier' | 'employee' | 'carrier';

export interface EntityNewSheetProps {
    type?: EntityModuleType;
    onClose?: () => void;
}

export const EntityNewSheet: Component<EntityNewSheetProps> = (props) => {
    const location = useLocation();
    const nav = useSheetNavigation(props);

    const resolvedType = (): EntityModuleType => {
        if (props.type) return props.type;
        const pathname = location.pathname;
        if (pathname.includes('/suppliers')) return 'supplier';
        if (pathname.includes('/employees')) return 'employee';
        if (pathname.includes('/carriers')) return 'carrier';
        return 'client';
    };

    const createClient = clientMutations.useCreate();
    const createSupplier = supplierMutations.useCreate();
    const createEmployee = employeeMutations.useCreate();

    const activeMutation = () => {
        const t = resolvedType();
        if (t === 'supplier') return createSupplier;
        if (t === 'employee') return createEmployee;
        return createClient;
    };

    const typeConfig = () => {
        const t = resolvedType();
        switch (t) {
            case 'supplier':
                return {
                    title: 'Nuevo Proveedor',
                    description: 'Ingresa los datos del nuevo proveedor',
                    btnText: 'Crear Proveedor',
                    successMsg: 'Proveedor creado correctamente',
                    errorMsg: 'Error al crear proveedor',
                    lockedRoles: { isSupplier: true },
                };
            case 'employee':
                return {
                    title: 'Nuevo Empleado',
                    description: 'Ingresa los datos del nuevo empleado',
                    btnText: 'Crear Empleado',
                    successMsg: 'Empleado creado correctamente',
                    errorMsg: 'Error al crear empleado',
                    lockedRoles: { isEmployee: true },
                };
            case 'carrier':
                return {
                    title: 'Nuevo Transportista',
                    description: 'Ingresa los datos del nuevo transportista',
                    btnText: 'Crear Transportista',
                    successMsg: 'Transportista creado correctamente',
                    errorMsg: 'Error al crear transportista',
                    lockedRoles: { isCarrier: true },
                };
            case 'client':
            default:
                return {
                    title: 'Nuevo Cliente',
                    description: 'Ingresa los datos del nuevo cliente',
                    btnText: 'Crear Cliente',
                    successMsg: 'Cliente creado correctamente',
                    errorMsg: 'Error al crear cliente',
                    lockedRoles: { isClient: true },
                };
        }
    };

    const handleSubmit = async (data: EntityFormData) => {
        const mutation = activeMutation();
        const config = typeConfig();

        if (isOffline()) {
            mutation.mutate(data);
            showOfflineSavedToast();
            nav.navigateAway();
            return;
        }

        try {
            await mutation.mutateAsync(data);
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
                        loadingText="Creando..."
                        icon={<FloppyDiskIcon />}
                    >
                        {typeConfig().btnText}
                    </Button>
                </>
            }
        >
            <EntityForm
                onSubmit={handleSubmit}
                isSubmitting={isPending()}
                lockedRoles={typeConfig().lockedRoles}
            />
        </Sheet>
    );
};

export default EntityNewSheet;
