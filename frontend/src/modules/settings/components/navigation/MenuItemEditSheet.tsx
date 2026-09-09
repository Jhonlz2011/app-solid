import { Component, createSignal, Show, createEffect, createMemo } from 'solid-js';
import { useParams } from '@tanstack/solid-router';
import { createForm } from '@tanstack/solid-form';
import { MenuItemFormSchema, type MenuItemFormData } from '@app/schema/frontend';
import type { MenuItemStatus } from '@app/schema/enums';
import { useSheetNavigation } from '@shared/hooks/useSheetNavigation';
import { executeFormMutation, handleFormApiErrors } from '@shared/utils/form.utils';
import { useTenantMenuItems } from '../../data/menu.queries';
import { useUpdateMenuItem } from '../../data/menu.mutations';
import { FloppyDiskIcon } from '@icons/FloppyDiskIcon';
import { LayoutIcon } from '@icons/LayoutIcon';
import { InfoIcon } from '@icons/InfoIcon';

import { FormSubmissionContext } from '@shared/ui/form/form.types';
import { SkeletonLoader } from '@display/SkeletonLoader';
import TextField from '@form/TextField';
import Sheet from '@overlay/Sheet';
import Button from '@form/Button';
import {
    SegmentedControl,
    SegmentedControlIndicator,
    SegmentedControlItem,
    SegmentedControlItemInput,
    SegmentedControlItemLabel,
} from '@form/SegmentedControl';

interface MenuItemEditSheetProps {
    moduleId?: number;
    onClose?: () => void;
}

const MenuItemEditSheet: Component<MenuItemEditSheetProps> = (props) => {
    const params = useParams({ strict: false }) as () => any;
    const { bindDismiss, close, navigateAway } = useSheetNavigation(props);
    const moduleId = () => props.moduleId ?? Number(params()?.moduleId);

    const menuQuery = useTenantMenuItems();
    const updateMut = useUpdateMenuItem();
    const [hasAttemptedSubmit, setHasAttemptedSubmit] = createSignal(false);

    const currentItem = createMemo(() => {
        const id = moduleId();
        if (!id) return undefined;
        return menuQuery.data?.find(m => m.id === id);
    });

    const form = createForm(() => ({
        defaultValues: {
            label: currentItem()?.label ?? '',
            path_alias: currentItem()?.path_alias ?? '',
            status: (currentItem()?.status ?? 'active') as MenuItemStatus,
        } as MenuItemFormData,
        validators: {
            onChange: MenuItemFormSchema,
            onSubmit: MenuItemFormSchema,
        },
        onSubmit: async ({ value }) => {
            const id = moduleId();
            if (!id || id <= 0) return;

            let cleanAlias = value.path_alias?.trim() || null;
            if (cleanAlias && !cleanAlias.startsWith('/')) {
                cleanAlias = `/${cleanAlias}`;
            }

            try {
                await executeFormMutation({
                    mutation: updateMut,
                    variables: {
                        id,
                        data: {
                            label: value.label.trim(),
                            path_alias: cleanAlias,
                            status: value.status,
                        },
                    },
                    successMessage: 'Módulo actualizado correctamente',
                    onComplete: navigateAway,
                });
            } catch (err) {
                handleFormApiErrors(form, err, 'Error al actualizar el módulo', 'module-edit-form');
            }
        },
    }));

    createEffect(() => {
        const item = currentItem();
        if (item) {
            form.setFieldValue('label', item.label);
            form.setFieldValue('path_alias', item.path_alias ?? '');
            form.setFieldValue('status', (item.status ?? 'active') as MenuItemStatus);
        }
    });

    // Preview URL helper
    const previewUrl = () => {
        const alias = form.getFieldValue('path_alias')?.trim();
        const fallback = currentItem()?.path ?? '';
        const effective = alias ? (alias.startsWith('/') ? alias : `/${alias}`) : fallback;
        const host = typeof window !== 'undefined' ? window.location.host : 'tuempresa.zelys.app';
        return `https://${host}${effective}`;
    };

    return (
        <Sheet
            bindDismiss={bindDismiss}
            isOpen={true}
            onClose={navigateAway}
            title="Personalizar Módulo"
            description="Configura el nombre visible, alias de URL y visibilidad para tu empresa"
            size="sm"
            footer={
                <>
                    <Button variant="outline" onClick={close} disabled={updateMut.isPending}>
                        Cancelar
                    </Button>
                    <Button
                        type="submit"
                        form="module-edit-form"
                        loading={updateMut.isPending}
                        loadingText="Guardando..."
                        icon={<FloppyDiskIcon />}
                    >
                        Guardar Cambios
                    </Button>
                </>
            }
        >
            <Show
                when={!menuQuery.isLoading}
                fallback={
                    <div class="py-6 space-y-4">
                        <SkeletonLoader type="text" count={3} />
                    </div>
                }
            >
                <Show
                    when={currentItem()}
                    fallback={
                        <div class="py-12 text-center text-muted">
                            <p>No se encontró el módulo solicitado.</p>
                        </div>
                    }
                >
                    <FormSubmissionContext.Provider value={hasAttemptedSubmit}>
                        <form
                            id="module-edit-form"
                            onSubmit={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                setHasAttemptedSubmit(true);
                                form.handleSubmit();
                            }}
                            class="space-y-4 py-2"
                        >
                            {/* Module Info Banner */}
                            <div class="p-3 bg-surface/60 rounded-xl border border-border/50 text-xs space-y-2">
                                <div class="flex items-center gap-2.5">
                                    <div class="size-7 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                                        <LayoutIcon class="size-4 text-primary" />
                                    </div>
                                    <div class="min-w-0 flex-1">
                                        <p class="font-semibold text-text truncate">
                                            {currentItem()?.label}
                                        </p>
                                        <p class="text-[11px] text-muted font-mono truncate">
                                            Clave: {currentItem()?.key}
                                        </p>
                                    </div>
                                </div>

                                <div class="pt-2 border-t border-border/40 flex items-center justify-between text-[11px]">
                                    <span class="text-muted">Ruta interna del sistema:</span>
                                    <code class="px-2 py-0.5 rounded bg-surface/80 border border-border/40 font-mono text-primary font-semibold">
                                        {currentItem()?.path || '— (Agrupador)'}
                                    </code>
                                </div>
                            </div>

                            {/* Label Field */}
                            <form.Field name="label">
                                {(field) => (
                                    <TextField.Root field={field()} disabled={updateMut.isPending}>
                                        <TextField.Label>Nombre en Menú *</TextField.Label>
                                        <TextField.Input
                                            type="text"
                                            placeholder="ej. Proveedores, Clientes..."
                                        />
                                        <TextField.ErrorMessage />
                                    </TextField.Root>
                                )}
                            </form.Field>

                            {/* Path Alias Field (Only if item has a real path) */}
                            <Show when={currentItem()?.path}>
                                <form.Field name="path_alias">
                                    {(field) => (
                                        <div class="space-y-1.5">
                                            <TextField.Root field={field()} disabled={updateMut.isPending}>
                                                <TextField.Label>Alias de Ruta (URL visible)</TextField.Label>
                                                <TextField.Input
                                                    type="text"
                                                    placeholder={`ej. ${currentItem()?.path_alias || currentItem()?.path}`}
                                                    class="font-mono text-xs"
                                                />
                                                <TextField.ErrorMessage />
                                            </TextField.Root>

                                            {/* Live URL Preview */}
                                            <div class="flex items-start gap-1.5 px-2.5 py-1.5 rounded-lg bg-primary/5 border border-primary/10 text-[11px] text-muted">
                                                <InfoIcon class="size-3.5 text-primary shrink-0 mt-0.5" />
                                                <div class="truncate">
                                                    <span>URL resultante: </span>
                                                    <span class="font-mono font-medium text-primary">
                                                        {previewUrl()}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </form.Field>
                            </Show>

                            {/* Status Field */}
                            <form.Field name="status">
                                {(field) => (
                                    <div class="space-y-1.5 pt-1">
                                        <label class="text-xs font-medium text-text block">
                                            Estado del Módulo
                                        </label>
                                        <SegmentedControl
                                            value={field().state.value}
                                            onChange={(val) => val && field().handleChange(val as MenuItemStatus)}
                                            class="w-full text-xs"
                                        >
                                            <SegmentedControlIndicator />
                                            <SegmentedControlItem value="active">
                                                <SegmentedControlItemInput />
                                                <SegmentedControlItemLabel class="text-xs! py-1.5! flex-1 text-center">
                                                    Activo
                                                </SegmentedControlItemLabel>
                                            </SegmentedControlItem>
                                            <SegmentedControlItem value="development">
                                                <SegmentedControlItemInput />
                                                <SegmentedControlItemLabel class="text-xs! py-1.5! flex-1 text-center">
                                                    En Desarrollo
                                                </SegmentedControlItemLabel>
                                            </SegmentedControlItem>
                                            <SegmentedControlItem value="deprecated">
                                                <SegmentedControlItemInput />
                                                <SegmentedControlItemLabel class="text-xs! py-1.5! flex-1 text-center">
                                                    Oculto
                                                </SegmentedControlItemLabel>
                                            </SegmentedControlItem>
                                        </SegmentedControl>
                                    </div>
                                )}
                            </form.Field>
                        </form>
                    </FormSubmissionContext.Provider>
                </Show>
            </Show>
        </Sheet>
    );
};

export default MenuItemEditSheet;
