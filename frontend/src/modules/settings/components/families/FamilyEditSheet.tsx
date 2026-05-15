import { Component, Show, createSignal, createEffect } from 'solid-js';
import { useParams } from '@tanstack/solid-router';
import { createForm } from '@tanstack/solid-form';
import { valibotValidator } from '@tanstack/valibot-form-adapter';
import { FamilyFormSchema, type FamilyFormData } from '@app/schema/frontend';
import { useSheetNavigation } from '@shared/hooks/useSheetNavigation';
import { toast } from 'solid-sonner';
import { useFamiliesList } from '../../data/families.queries';
import { useUpdateFamily, useDeactivateFamily, useRestoreFamily } from '../../data/families.mutations';
import type { FamilyItem } from '../../data/families.api';
import { FloppyDiskIcon } from '@shared/ui/icons';
import { FormSubmissionContext } from '@shared/ui/form/form.types';
import { CategorySelect } from '@shared/ui/selectors';
import { SkeletonLoader } from '@shared/ui/SkeletonLoader';
import TextField from '@shared/ui/TextField';
import Sheet from '@shared/ui/Sheet';
import Button from '@shared/ui/Button';

interface FamilyEditSheetProps { onClose?: () => void; onBack?: () => void; }

const FamilyEditSheet: Component<FamilyEditSheetProps> = (props) => {
    const params = useParams({ strict: false }) as () => { familyId?: string };
    const { bindDismiss, close, navigateAway } = useSheetNavigation(props);
    const [hasAttemptedSubmit, setHasAttemptedSubmit] = createSignal(false);

    const familyId = () => { const p = Number(params()?.familyId); return Number.isFinite(p) ? p : 0; };

    const familiesQuery = useFamiliesList();
    const updateMut = useUpdateFamily();
    const deactivateMut = useDeactivateFamily();
    const restoreMut = useRestoreFamily();

    const family = () => (familiesQuery.data ?? []).find((f: FamilyItem) => f.id === familyId()) ?? null;

    const form = createForm(() => ({
        defaultValues: { name: '', categoryId: null, description: '' } as FamilyFormData,
        validatorAdapter: valibotValidator(),
        validators: { onChange: FamilyFormSchema, onSubmit: FamilyFormSchema },
        onSubmit: async ({ value }) => {
            if (familyId() === 0) return;
            updateMut.mutate(
                { id: familyId(), data: { name: value.name, categoryId: value.categoryId || null, description: value.description || null } },
                {
                    onSuccess: () => { toast.success('Familia actualizada'); navigateAway(); },
                    onError: (err: any) => toast.error(err.message || 'Error al actualizar'),
                },
            );
        },
    }));

    createEffect(() => {
        const f = family();
        if (f) {
            form.setFieldValue('name', f.name);
            form.setFieldValue('categoryId', f.category_id);
            form.setFieldValue('description', f.description ?? '');
        }
    });

    const handleToggleActive = () => {
        const f = family();
        if (!f) return;
        const isActive = f.is_active ?? true;
        (isActive ? deactivateMut : restoreMut).mutate(f.id, {
            onSuccess: () => { toast.success(isActive ? 'Familia desactivada' : 'Familia restaurada'); navigateAway(); },
            onError: (err: any) => toast.error(err.message || 'Error'),
        });
    };

    const isSaving = () => updateMut.isPending || deactivateMut.isPending || restoreMut.isPending;

    return (
        <Sheet
            bindDismiss={bindDismiss} isOpen={true} onClose={navigateAway} onBack={props.onBack}
            title="Editar Familia" description="Modifica los datos de la familia de productos" size="md"
            footer={
                <>
                    <Show when={family()}>
                        <Button variant={(family()?.is_active ?? true) ? 'danger' : 'success'} onClick={handleToggleActive} loading={deactivateMut.isPending || restoreMut.isPending}>
                            {(family()?.is_active ?? true) ? 'Desactivar' : 'Restaurar'}
                        </Button>
                    </Show>
                    <div class="flex-1" />
                    <Button variant="outline" onClick={close} disabled={isSaving()}>Cancelar</Button>
                    <Button type="submit" form="family-edit-form" loading={updateMut.isPending} loadingText="Guardando..." icon={<FloppyDiskIcon />}>
                        Guardar
                    </Button>
                </>
            }
        >
            <Show when={familyId() > 0} fallback={<div class="py-12 text-center text-muted">ID de familia inválido</div>}>
                <Show when={!familiesQuery.isLoading} fallback={<SkeletonLoader type="text" count={3} />}>
                    <Show when={family()} fallback={<div class="py-12 text-center text-muted">Familia no encontrada</div>}>
                        <FormSubmissionContext.Provider value={hasAttemptedSubmit}>
                            <form id="family-edit-form" onSubmit={(e) => { e.preventDefault(); setHasAttemptedSubmit(true); form.handleSubmit(); }} class="space-y-5 py-2">
                                <form.Field name="name">
                                    {(field) => (
                                        <TextField.Root field={field()}>
                                            <TextField.Label>Nombre *</TextField.Label>
                                            <TextField.Input type="text" />
                                            <TextField.ErrorMessage />
                                        </TextField.Root>
                                    )}
                                </form.Field>
                                <CategorySelect
                                    value={form.getFieldValue('categoryId') ?? null}
                                    onChange={(id) => form.setFieldValue('categoryId', id)}
                                    label="Categoría"
                                />
                                <form.Field name="description">
                                    {(field) => (
                                        <TextField.Root field={field()}>
                                            <TextField.Label>Descripción</TextField.Label>
                                            <TextField.TextArea rows={2} />
                                            <TextField.ErrorMessage />
                                        </TextField.Root>
                                    )}
                                </form.Field>
                            </form>
                        </FormSubmissionContext.Provider>
                    </Show>
                </Show>
            </Show>
        </Sheet>
    );
};

export default FamilyEditSheet;
