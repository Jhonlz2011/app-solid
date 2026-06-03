import { Component, Show, createSignal, createEffect, on } from 'solid-js';
import { isNetworkError } from '@shared/utils/api-errors';
import { useParams } from '@tanstack/solid-router';
import { createForm } from '@tanstack/solid-form';
import { valibotValidator } from '@tanstack/valibot-form-adapter';
import { UomFormSchema, type UomFormData } from '@app/schema/frontend';
import { useSheetNavigation } from '@shared/hooks/useSheetNavigation';
import { toast } from 'solid-sonner';
import { useUomList } from '../data/uom.queries';
import { useUpdateUom } from '../data/uom.mutations';
import type { UomItem } from '../data/uom.api';
import { useAuth } from '@modules/auth/store/auth.store';
import { FloppyDiskIcon, LockIcon } from '@shared/ui/icons';
import { SkeletonLoader } from '@shared/ui/SkeletonLoader';
import Sheet from '@shared/ui/Sheet';
import Button from '@shared/ui/Button';
import UomForm from './UomForm';

interface UomEditSheetProps { onClose?: () => void; onBack?: () => void; }

const UomEditSheet: Component<UomEditSheetProps> = (props) => {
    const params = useParams({ strict: false }) as () => { uomId?: string };
    const { bindDismiss, close, navigateAway } = useSheetNavigation(props);
    const [hasAttemptedSubmit, setHasAttemptedSubmit] = createSignal(false);
    const auth = useAuth();
    const canEdit = () => auth.canEdit('uom');

    const uomId = () => Number(params()?.uomId) || 0;

    const uomQuery = useUomList();
    const updateMut = useUpdateUom();

    const uomItem = () => ((uomQuery.data ?? []) as UomItem[]).find(u => u.id === uomId()) ?? null;
    const isSystem = () => uomItem()?.is_system ?? false;
    const isEditable = () => !isSystem() && canEdit();

    const form = createForm(() => ({
        defaultValues: { code: '', name: '', uom_group: 'CANTIDAD', base_factor: '1' } as UomFormData,
        validatorAdapter: valibotValidator(),
        validators: { onChange: UomFormSchema, onSubmit: UomFormSchema },
        onSubmit: async ({ value }) => {
            if (!uomId() || !isEditable()) return;
            updateMut.mutate(
                { id: uomId(), data: { name: value.name, uom_group: value.uom_group, base_factor: value.base_factor ? String(value.base_factor).replace(',', '.') : undefined } },
                {
                    onSuccess: () => { toast.success('Unidad actualizada'); navigateAway(); },
                    onError: (err: any) => {
                        if (isNetworkError(err)) { toast.info('Guardado localmente', { description: 'Se sincronizará automáticamente al recuperar la conexión.', icon: '☁️' }); navigateAway(); return; }
                        toast.error(err.message || 'Error al actualizar');
                    },
                },
            );
        },
    }));

    createEffect(on(uomItem, (item) => {
        if (item) {
            form.setFieldValue('code', item.code);
            form.setFieldValue('name', item.name);
            form.setFieldValue('uom_group', item.uom_group as any);
            form.setFieldValue('base_factor', item.base_factor ?? '1');
        }
    }));

    const handleSubmit = () => { setHasAttemptedSubmit(true); form.handleSubmit(); };

    return (
        <Sheet
            bindDismiss={bindDismiss} isOpen={true} onClose={navigateAway} onBack={props.onBack}
            title={isSystem() ? 'Unidad del Sistema' : 'Editar Unidad de Medida'}
            description={isSystem() ? 'Las unidades del sistema son de solo lectura' : 'Modifica los datos de la unidad'}
            size="md"
            footer={
                <>
                    <div class="flex-1" />
                    <Button variant="outline" onClick={close} disabled={updateMut.isPending}>Cancelar</Button>
                    <Show when={isEditable()}>
                        <Button type="submit" form="uom-edit-form" loading={updateMut.isPending} loadingText="Guardando..." icon={<FloppyDiskIcon />} onClick={handleSubmit}>
                            Guardar
                        </Button>
                    </Show>
                </>
            }
        >
            <Show when={uomId()} fallback={<div class="py-12 text-center text-muted">ID inválido</div>}>
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
                            form={form}
                            formId="uom-edit-form"
                            hasAttemptedSubmit={hasAttemptedSubmit}
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
