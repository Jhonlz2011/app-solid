import { Component, Show } from 'solid-js';
import { toast } from 'solid-sonner';
import { useClient, useUpdateClient } from '../data/clients.api';
import { EntityForm } from '@shared/forms/entity';
import type { EntityFormData } from '@app/schema/frontend';
import { ApiError } from '@shared/utils/api-errors';
import { SkeletonLoader } from '@shared/ui/SkeletonLoader';
import Sheet from '@shared/ui/Sheet';
import Button from '@shared/ui/Button';
import { FloppyDiskIcon } from '@shared/ui/icons';

interface ClientEditSheetProps {
    clientId: number;
    onClose: () => void;
    onBack?: () => void;
}

const ClientEditSheet: Component<ClientEditSheetProps> = (props) => {
    const clientId = () => props.clientId;

    const clientQuery = useClient(clientId);
    const updateMutation = useUpdateClient();

    let dismissSheet: () => void;

    const handleClose = () => {
        if (dismissSheet) dismissSheet();
        else {
            if (props.onBack) props.onBack();
            else props.onClose();
        }
    };

    const handleSubmit = async (data: EntityFormData) => {
        if (clientId() === 0) return;

        try {
            // Remove taxId and taxIdType as they are not allowed by ClientUpdateSchema in backend
            const { taxId, taxIdType, ...updateData } = data;
            await updateMutation.mutateAsync({ id: clientId(), data: updateData });
            toast.success('Cliente actualizado correctamente');
            handleClose();
        } catch (error: any) {
            const hasFieldErrors = error instanceof ApiError && (error.errors?.length ?? 0) > 0;
            if (!hasFieldErrors) {
                toast.error(error?.message || 'Error al editar cliente');
            }
            throw error;
        }
    };

    return (
        <Sheet
            bindDismiss={(fn) => dismissSheet = fn}
            isOpen={true}
            onClose={props.onClose}
            onBack={props.onBack}
            title="Editar Cliente"
            description="Modifica los datos del cliente"
            size="xxxxl"
            footer={
                <>
                    <Button variant="outline" type="button" onClick={handleClose} disabled={updateMutation.isPending}>
                        Cancelar
                    </Button>
                    <Button
                        type="submit"
                        form="entity-form"
                        loading={updateMutation.isPending}
                        loadingText="Guardando..."
                        class="min-w-[200px]"
                        icon={<FloppyDiskIcon/>}
                    >
                        Guardar Cambios
                    </Button>
                </>
            }
        >
            <Show
                when={clientId() > 0}
                fallback={
                    <div class="flex flex-col items-center justify-center py-12 text-center">
                        <div class="text-4xl mb-4">🔍</div>
                        <p class="text-muted">ID de cliente inválido</p>
                        <p class="text-sm text-muted/70 mt-1">Verifica la URL e intenta de nuevo</p>
                    </div>
                }
            >
                <Show
                    when={!clientQuery.isLoading}
                    fallback={
                        <div class="space-y-6 p-2">
                            <SkeletonLoader type="text" count={2} />
                            <SkeletonLoader type="text" count={3} />
                            <SkeletonLoader type="text" count={2} />
                        </div>
                    }
                >
                    <Show
                        when={clientQuery.data}
                        fallback={
                            <div class="flex flex-col items-center justify-center py-12 text-center">
                                <div class="text-4xl mb-4">📭</div>
                                <p class="text-muted">No se encontró el cliente</p>
                            </div>
                        }
                    >
                        <EntityForm
                            entity={clientQuery.data}
                            onSubmit={handleSubmit}
                            isSubmitting={updateMutation.isPending}
                            lockedRoles={{ isClient: true }}
                        />
                    </Show>
                </Show>
            </Show>
        </Sheet>
    );
};

export default ClientEditSheet;
