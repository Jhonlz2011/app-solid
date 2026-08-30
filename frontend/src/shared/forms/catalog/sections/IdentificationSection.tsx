/**
 * IdentificationSection — Name (with template support), SKU, Barcode, Description.
 * Slug is auto-generated on submit and never shown to the user.
 * SKU and Barcode come from variants[0] (default variant).
 */
import { Component, Show } from 'solid-js';
import type { CatalogFormApi } from '../catalog-form.types';
import TextField from '@form/TextField';
import { Badge } from '@display/Badge';
import { EditIcon } from '@icons/EditIcon';
import { RotateCcwIcon } from '@icons/RotateCcwIcon';
import FormSectionHeader from '@form/FormSectionHeader';

interface IdentificationSectionProps {
    form: CatalogFormApi;
    hasTemplate: () => boolean;
    manualNameOverride: () => boolean;
    setManualNameOverride: (v: boolean) => void;
}

const IdentificationSection: Component<IdentificationSectionProps> = (props) => {
    return (
        <fieldset class="space-y-5 bg-surface/30 p-5 rounded-2xl border border-border/40">
            <FormSectionHeader color="success" title="Identificación" />

            {/* Name */}
            <props.form.Field name="name">
                {(field) => (
                    <TextField.Root field={field()}>
                        <TextField.Label>
                            <span class="flex items-center gap-2">
                                Nombre del Producto *
                                <Show when={props.hasTemplate()}>
                                    <Badge variant="info" class="text-[10px] px-1.5 py-0">Auto-generado</Badge>
                                </Show>
                            </span>
                        </TextField.Label>
                        <TextField.Input
                            type="text"
                            placeholder={props.hasTemplate() ? 'Se genera automáticamente desde los atributos...' : 'Nombre del producto'}
                            readOnly={props.hasTemplate() && !props.manualNameOverride()}
                            class={props.hasTemplate() && !props.manualNameOverride() ? 'bg-surface/60 cursor-default' : ''}
                        />
                        <TextField.ErrorMessage />
                    </TextField.Root>
                )}
            </props.form.Field>
            <Show when={props.hasTemplate() && !props.manualNameOverride()}>
                <button
                    type="button"
                    class="inline-flex items-center gap-1.5 text-xs text-primary hover:text-primary/80 transition-colors -mt-3 cursor-pointer"
                    onClick={() => props.setManualNameOverride(true)}
                >
                    <EditIcon class="size-3.5" />
                    <span>Editar nombre manualmente</span>
                </button>
            </Show>
            <Show when={props.hasTemplate() && props.manualNameOverride()}>
                <button
                    type="button"
                    class="inline-flex items-center gap-1.5 text-xs text-info hover:text-info/80 transition-colors -mt-3 cursor-pointer"
                    onClick={() => props.setManualNameOverride(false)}
                >
                    <RotateCcwIcon class="size-3.5" />
                    <span>Volver a nombre automático</span>
                </button>
            </Show>

            {/* SKU + Barcode (from default variant variants[0]) */}
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <props.form.Field name={"variants[0].sku" }>
                    {(field) => (
                        <TextField.Root field={field()}>
                            <TextField.Label>SKU *</TextField.Label>
                            <TextField.Input type="text" placeholder="Auto-generado al guardar" class="font-mono" />
                            <TextField.ErrorMessage />
                        </TextField.Root>
                    )}
                </props.form.Field>

                <props.form.Field name={"variants[0].barcode" }>
                    {(field) => (
                        <TextField.Root field={field()}>
                            <TextField.Label>Código de Barras</TextField.Label>
                            <TextField.Input type="text" class="font-mono" placeholder="EAN/UPC" />
                        </TextField.Root>
                    )}
                </props.form.Field>
            </div>

            {/* Description */}
            <props.form.Field name="description">
                {(field) => (
                    <TextField.Root field={field()}>
                        <TextField.Label>Descripción</TextField.Label>
                        <TextField.TextArea
                            placeholder="Descripción opcional del producto..."
                            rows={3}
                        />
                    </TextField.Root>
                )}
            </props.form.Field>
        </fieldset>
    );
};

export default IdentificationSection;
