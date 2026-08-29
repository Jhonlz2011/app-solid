import { Component, Show } from 'solid-js';
import { useParams } from '@tanstack/solid-router';
import type { UomFormData } from '@app/schema/frontend';
import { useSheetNavigation } from '@shared/hooks/useSheetNavigation';
import { executeFormMutation } from '@shared/utils/form.utils';
import { useUom } from '../data/uom.queries';
import { useUpdateUom } from '../data/uom.mutations';
import { useAuth } from '@modules/auth/store/auth.store';
import { FloppyDiskIcon } from '@icons/FloppyDiskIcon';
import { LockIcon } from '@icons/LockIcon';
import { SkeletonLoader } from '@display/SkeletonLoader';
import Sheet from '@overlay/Sheet';
import Button from '@form/Button';
import { UomForm } from './UomForm';

interface UomEditSheetProps {
    onClose?: () => void;
}

const UomEditSheet: Component<UomEditSheetProps> = (props) => {
    const params = useParams({ strict: false }) as () => { uomId?: string };
    const { bindDismiss, close, navigateAway } = useSheetNavigation(props);
    const auth = useAuth();
    const canEdit = () => auth.canEdit('uom');

    const uomId = () => Number(params()?.uomId) || 0;

    const uomQuery = useUom(uomId);
    const updateMut = useUpdateUom();

    const uomItem = () => uomQuery.data ?? null;
    const isSystem = () => uomItem()?.is_system ?? false;
    const isEditable = () => !isSystem() && canEdit();

    const handleSubmit = async (values: UomFormData) => {
        const id = uomId();
        if (!id || !isEditable()) return;

        return executeFormMutation({
            mutation: updateMut,
            variables: {
                id,
                data: {
                    name: values.name,
                    uom_group: values.uom_group,
                    base_factor: values.base_factor ? String(values.base_factor).replace(',', '.') : undefined,
                },
            },
            successMessage: 'Unidad actualizada',
            onComplete: navigateAway,
        });
    };

    return (
        <Sheet
            bindDismiss={bindDismiss}
            isOpen={true}
            onClose={navigateAway}
            title={isSystem() ? 'Unidad del Sistema' : 'Editar Unidad de Medida'}
            description={isSystem() ? 'Las unidades del sistema son de solo lectura' : 'Modifica los datos de la unidad'}
            size="md"
            footer={
                <>
                    <div class="flex-1" />
                    <Button variant="outline" onClick={close} disabled={updateMut.isPending}>
                        Cancelar
                    </Button>
                    <Show when={isEditable()}>
                        <Button
                            type="submit"
                            form="uom-edit-form"
                            loading={updateMut.isPending}
                            loadingText="Guardando..."
                            icon={<FloppyDiskIcon />}
                        >
                            Guardar
                        </Button>
                    </Show>
                </>
            }
        >
            <Show when={uomId() > 0} fallback={<div class="py-12 text-center text-muted">ID inválido</div>}>
                <Show when={!uomQuery.isLoading} fallback={<SkeletonLoader type="text" count={3} />}>
                    <Show when={uomItem()} fallback={<div class="py-12 text-center text-muted">Unidad no encontrada</div>}>
                        {/* System UOM banner */}
                        <Show when={isSystem()}>
                            <div class="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-surface/80 border border-border text-muted text-sm mb-4 mt-4">
                                <LockIcon class="size-4 shrink-0" />
                                <span>Esta unidad es del sistema y no puede ser modificada.</span>
                            </div>
                        </Show>

                        <UomForm
                            uom={uomItem()}
                            formId="uom-edit-form"
                            onSubmit={handleSubmit}
                            isSubmitting={updateMut.isPending}
                            disabled={!isEditable()}
                            disableCode={true}
                        />
                    </Show>
                </Show>
            </Show>
        </Sheet>
    );
};

export default UomEditSheet;
