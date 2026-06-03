import { Component, Show } from 'solid-js';
import { useParams } from '@tanstack/solid-router';
import { useSheetNavigation } from '@shared/hooks/useSheetNavigation';
import { toast } from 'solid-sonner';
import { useAttributeDetail } from '../data/attributes.queries';
import { useUpdateAttribute } from '../data/attributes.mutations';
import AttributeForm from './AttributeForm';
import type { AttributeFormData } from '@app/schema/frontend';
import { ApiError, isNetworkError } from '@shared/utils/api-errors';
import { SkeletonLoader } from '@shared/ui/SkeletonLoader';
import Sheet from '@shared/ui/Sheet';
import Button from '@shared/ui/Button';
import { FloppyDiskIcon } from '@shared/ui/icons';

interface AttributeEditSheetProps {
    attributeId?: number;
    onClose?: () => void;
    onBack?: () => void;
}

const AttributeEditSheet: Component<AttributeEditSheetProps> = (props) => {
    const params = useParams({ strict: false }) as () => { attributeId?: string };
    const { bindDismiss, close, navigateAway } = useSheetNavigation(props);
    
    const attributeId = () => {
        if (props.attributeId) return props.attributeId;
        const parsed = Number(params()?.attributeId);
        return Number.isFinite(parsed) ? parsed : 0;
    };

    const attributeQuery = useAttributeDetail(attributeId);
    const updateMutation = useUpdateAttribute();

    const handleSubmit = async (data: AttributeFormData) => {
        if (attributeId() === 0) return;

        try {
            await updateMutation.mutateAsync({ id: attributeId(), data });
            toast.success('Atributo actualizado correctamente');
            navigateAway();
        } catch (error: any) {
            if (isNetworkError(error)) {
                toast.info('Guardado localmente', { description: 'Se sincronizará automáticamente al recuperar la conexión.', icon: '☁️' });
                navigateAway();
                return;
            }
            const hasFieldErrors = error instanceof ApiError && (error.errors?.length ?? 0) > 0;
            if (!hasFieldErrors) {
                toast.error(error?.message || 'Error al editar atributo');
            }
            throw error;
        }
    };

    return (
        <Sheet
            bindDismiss={bindDismiss}
            isOpen={true}
            onClose={navigateAway}
            onBack={props.onBack}
            title="Editar Atributo"
            description="Modifica los datos del atributo"
            size="xl"
            footer={
                <>
                    <div class="flex-1" />
                    <Button variant="outline" type="button" onClick={close} disabled={updateMutation.isPending}>
                        Cancelar
                    </Button>
                    <Button
                        type="submit"
                        form="attribute-form"
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
                when={attributeId() > 0}
                fallback={
                    <div class="flex flex-col items-center justify-center py-12 text-center">
                        <div class="text-4xl mb-4">🔍</div>
                        <p class="text-muted">ID de atributo inválido</p>
                        <p class="text-sm text-muted/70 mt-1">Verifica la URL e intenta de nuevo</p>
                    </div>
                }
            >
                <Show
                    when={!attributeQuery.isLoading}
                    fallback={
                        <div class="space-y-6 p-2">
                            <SkeletonLoader type="text" count={2} />
                            <SkeletonLoader type="card" class="h-40" />
                        </div>
                    }
                >
                    <Show
                        when={attributeQuery.data}
                        fallback={
                            <div class="flex flex-col items-center justify-center py-12 text-center">
                                <div class="text-4xl mb-4">📭</div>
                                <p class="text-muted">No se encontró el atributo</p>
                            </div>
                        }
                    >
                        <AttributeForm
                            attribute={attributeQuery.data}
                            onSubmit={handleSubmit}
                            isSubmitting={updateMutation.isPending}
                        />
                    </Show>
                </Show>
            </Show>
        </Sheet>
    );
};

export default AttributeEditSheet;
