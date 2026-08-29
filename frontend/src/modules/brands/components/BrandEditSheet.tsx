import { Component, Show } from 'solid-js';
import { useParams } from '@tanstack/solid-router';
import type { BrandFormData } from '@app/schema/frontend';
import { useSheetNavigation } from '@shared/hooks/useSheetNavigation';
import { executeFormMutation } from '@shared/utils/form.utils';
import { useBrand } from '../data/brands.queries';
import { useUpdateBrand, useDeactivateBrand, useRestoreBrand } from '../data/brands.mutations';
import { FloppyDiskIcon } from '@icons/FloppyDiskIcon';
import { SkeletonLoader } from '@display/SkeletonLoader';
import Sheet from '@overlay/Sheet';
import Button from '@form/Button';
import { BrandForm } from './BrandForm';

interface BrandEditSheetProps {
    onClose?: () => void;
}

const BrandEditSheet: Component<BrandEditSheetProps> = (props) => {
    const params = useParams({ strict: false }) as () => { brandId?: string };
    const { bindDismiss, close, navigateAway } = useSheetNavigation(props);

    const brandId = () => {
        const p = Number(params()?.brandId);
        return Number.isFinite(p) ? p : 0;
    };

    const brandQuery = useBrand(brandId);
    const updateMut = useUpdateBrand();
    const deactivateMut = useDeactivateBrand();
    const restoreMut = useRestoreBrand();

    const brand = () => brandQuery.data ?? null;

    const handleSubmit = async (values: BrandFormData) => {
        const id = brandId();
        if (id === 0) return;

        return executeFormMutation({
            mutation: updateMut,
            variables: { id, data: { name: values.name, website: values.website || undefined } },
            successMessage: 'Marca actualizada',
            onComplete: navigateAway,
        });
    };

    const handleToggleActive = () => {
        const b = brand();
        if (!b) return;
        const isActive = b.is_active ?? true;
        const mut = isActive ? deactivateMut : restoreMut;

        executeFormMutation({
            mutation: mut,
            variables: b.id,
            successMessage: isActive ? 'Marca desactivada' : 'Marca restaurada',
            onComplete: navigateAway,
        });
    };

    const isSaving = () => updateMut.isPending || deactivateMut.isPending || restoreMut.isPending;

    return (
        <Sheet
            bindDismiss={bindDismiss}
            isOpen={true}
            onClose={navigateAway}
            title="Editar Marca"
            description="Modifica los datos de la marca"
            size="sm"
            footer={
                <>
                    <Show when={brand()}>
                        <Button
                            variant={(brand()?.is_active ?? true) ? 'danger' : 'success'}
                            onClick={handleToggleActive}
                            loading={deactivateMut.isPending || restoreMut.isPending}
                        >
                            {(brand()?.is_active ?? true) ? 'Desactivar' : 'Restaurar'}
                        </Button>
                    </Show>
                    <div class="flex-1" />
                    <Button variant="outline" onClick={close} disabled={isSaving()}>
                        Cancelar
                    </Button>
                    <Button
                        type="submit"
                        form="brand-edit-form"
                        loading={updateMut.isPending}
                        loadingText="Guardando..."
                        icon={<FloppyDiskIcon />}
                    >
                        Guardar
                    </Button>
                </>
            }
        >
            <Show when={brandId() > 0} fallback={<div class="py-12 text-center text-muted">ID de marca inválido</div>}>
                <Show when={!brandQuery.isLoading} fallback={<SkeletonLoader type="text" count={2} />}>
                    <Show when={brand()} fallback={<div class="py-12 text-center text-muted">Marca no encontrada</div>}>
                        <BrandForm
                            brand={brand()}
                            formId="brand-edit-form"
                            onSubmit={handleSubmit}
                            isSubmitting={updateMut.isPending}
                        />
                    </Show>
                </Show>
            </Show>
        </Sheet>
    );
};

export default BrandEditSheet;
