import { Component, Show, createSignal, createEffect, untrack } from 'solid-js';
import { isNetworkError } from '@shared/utils/api-errors';
import { isOffline, showOfflineSavedToast } from '@shared/utils/offline-submit';
import { useParams } from '@tanstack/solid-router';
import { createForm } from '@tanstack/solid-form';
import { valibotValidator } from '@tanstack/valibot-form-adapter';
import { BrandFormSchema, type BrandFormData } from '@app/schema/frontend';
import { useSheetNavigation } from '@shared/hooks/useSheetNavigation';
import { toast } from 'solid-sonner';
import { useBrand } from '../data/brands.queries';
import { useUpdateBrand, useDeactivateBrand, useRestoreBrand } from '../data/brands.mutations';
import { FloppyDiskIcon } from '@shared/ui/icons';
import { FormSubmissionContext } from '@shared/ui/form/form.types';
import { SkeletonLoader } from '@shared/ui/SkeletonLoader';
import TextField from '@shared/ui/TextField';
import Sheet from '@shared/ui/Sheet';
import Button from '@shared/ui/Button';

interface BrandEditSheetProps { onClose?: () => void; }

const BrandEditSheet: Component<BrandEditSheetProps> = (props) => {
    const params = useParams({ strict: false }) as () => { brandId?: string };
    const { bindDismiss, close, navigateAway } = useSheetNavigation(props);
    const [hasAttemptedSubmit, setHasAttemptedSubmit] = createSignal(false);

    const brandId = () => { const p = Number(params()?.brandId); return Number.isFinite(p) ? p : 0; };

    const brandQuery = useBrand(brandId);
    const updateMut = useUpdateBrand();
    const deactivateMut = useDeactivateBrand();
    const restoreMut = useRestoreBrand();

    const brand = () => brandQuery.data ?? null;

    const form = createForm(() => ({
        defaultValues: { name: '', website: '' } as BrandFormData,
        validatorAdapter: valibotValidator(),
        validators: { onChange: BrandFormSchema, onSubmit: BrandFormSchema },
        onSubmit: async ({ value }) => {
            if (brandId() === 0) return;
            if (isOffline()) {
                updateMut.mutate({ id: brandId(), data: { name: value.name, website: value.website || undefined } });
                showOfflineSavedToast();
                navigateAway();
                return;
            }
            updateMut.mutate(
                { id: brandId(), data: { name: value.name, website: value.website || undefined } },
                {
                    onSuccess: () => { toast.success('Marca actualizada'); navigateAway(); },
                    onError: (err: any) => {
                        if (isNetworkError(err)) { toast.info('Guardado localmente', { description: 'Se sincronizará automáticamente al recuperar la conexión.', icon: '☁️' }); navigateAway(); return; }
                        toast.error(err.message || 'Error al actualizar');
                    },
                },
            );
        },
    }));

    createEffect(() => {
        const b = brand();
        if (b) {
            untrack(() => {
                form.setFieldValue('name', b.name);
                form.setFieldValue('website', b.website ?? '');
            });
        }
    });

    const handleToggleActive = () => {
        const b = brand();
        if (!b) return;
        const isActive = b.is_active ?? true;
        if (isOffline()) {
            (isActive ? deactivateMut : restoreMut).mutate(b.id);
            showOfflineSavedToast();
            navigateAway();
            return;
        }
        (isActive ? deactivateMut : restoreMut).mutate(b.id, {
            onSuccess: () => { toast.success(isActive ? 'Marca desactivada' : 'Marca restaurada'); navigateAway(); },
            onError: (err: any) => {
                if (isNetworkError(err)) { toast.info('Guardado localmente', { description: 'Se sincronizará automáticamente al recuperar la conexión.', icon: '☁️' }); navigateAway(); return; }
                toast.error(err.message || 'Error');
            },
        });
    };

    const isSaving = () => updateMut.isPending || deactivateMut.isPending || restoreMut.isPending;

    return (
        <Sheet
            bindDismiss={bindDismiss} isOpen={true} onClose={navigateAway}
            title="Editar Marca" description="Modifica los datos de la marca" size="sm"
            footer={
                <>
                    <Show when={brand()}>
                        <Button variant={(brand()?.is_active ?? true) ? 'danger' : 'success'} onClick={handleToggleActive} loading={deactivateMut.isPending || restoreMut.isPending}>
                            {(brand()?.is_active ?? true) ? 'Desactivar' : 'Restaurar'}
                        </Button>
                    </Show>
                    <div class="flex-1" />
                    <Button variant="outline" onClick={close} disabled={isSaving()}>Cancelar</Button>
                    <Button type="submit" form="brand-edit-form" loading={updateMut.isPending} loadingText="Guardando..." icon={<FloppyDiskIcon />}>
                        Guardar
                    </Button>
                </>
            }
        >
            <Show when={brandId() > 0} fallback={<div class="py-12 text-center text-muted">ID de marca inválido</div>}>
                <Show when={!brandQuery.isLoading} fallback={<SkeletonLoader type="text" count={2} />}>
                    <Show when={brand()} fallback={<div class="py-12 text-center text-muted">Marca no encontrada</div>}>
                        <FormSubmissionContext.Provider value={hasAttemptedSubmit}>
                            <form id="brand-edit-form" onSubmit={(e) => { e.preventDefault(); setHasAttemptedSubmit(true); form.handleSubmit(); }} class="space-y-5 py-2">
                                <form.Field name="name">
                                    {(field) => (
                                        <TextField.Root field={field()}>
                                            <TextField.Label>Nombre *</TextField.Label>
                                            <TextField.Input type="text" />
                                            <TextField.ErrorMessage />
                                        </TextField.Root>
                                    )}
                                </form.Field>
                                <form.Field name="website">
                                    {(field) => (
                                        <TextField.Root field={field()}>
                                            <TextField.Label>Sitio Web</TextField.Label>
                                            <TextField.Input type="url" placeholder="https://www.marca.com" />
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

export default BrandEditSheet;
