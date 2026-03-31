import { Component } from 'solid-js';
import { toast } from 'solid-sonner';
import { useCreateClient } from '../data/clients.api';
import { useSheetNavigation } from '@shared/hooks/useSheetNavigation';
import { EntityForm } from '@shared/forms/entity';
import type { EntityFormData } from '@app/schema/frontend';
import { ApiError } from '@shared/utils/api-errors';
import { FloppyDiskIcon } from '@shared/ui/icons';
import Sheet from '@shared/ui/Sheet';
import Button from '@shared/ui/Button';

interface ClientNewSheetProps {
    onClose?: () => void;
}

const ClientNewSheet: Component<ClientNewSheetProps> = (props) => {
    const createMutation = useCreateClient();
    const nav = useSheetNavigation(props);

    const handleSubmit = async (data: EntityFormData) => {
        try {
            await createMutation.mutateAsync(data);
            toast.success('Cliente creado correctamente');
            nav.close();
        } catch (error: any) {
            const hasFieldErrors = error instanceof ApiError && (error.errors?.length ?? 0) > 0;
            if (!hasFieldErrors) toast.error(error?.message || 'Error al crear cliente');
            throw error;
        }
    };

    return (
        <Sheet
            bindDismiss={nav.bindDismiss}
            isOpen={true}
            onClose={nav.navigateAway}
            title="Nuevo Cliente"
            description="Ingresa los datos del nuevo cliente"
            size="xxxxl"
            footer={
                <>
                    <Button variant="outline" type="button" onClick={nav.close} disabled={createMutation.isPending}>
                        Cancelar
                    </Button>
                    <Button
                        type="submit"
                        form="entity-form"
                        loading={createMutation.isPending}
                        loadingText="Creando..."
                        class="min-w-[200px]"
                        icon={<FloppyDiskIcon />}
                    >
                        Crear Cliente
                    </Button>
                </>
            }
        >
            <EntityForm
                onSubmit={handleSubmit}
                isSubmitting={createMutation.isPending}
                lockedRoles={{ isClient: true }}
            />
        </Sheet>
    );
};

export default ClientNewSheet;

