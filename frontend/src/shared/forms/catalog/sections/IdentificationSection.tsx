/**
 * IdentificationSection — Clean Shopify-style Title & Description card.
 * Elevated bg-card with crisp borders.
 */
import { Component, Show } from 'solid-js';
import type { CatalogFormApi } from '../catalog-form.types';
import TextField from '@form/TextField';
import { Badge } from '@display/Badge';
import { EditIcon } from '@icons/EditIcon';
import { RotateCcwIcon } from '@icons/RotateCcwIcon';

interface IdentificationSectionProps {
    form: CatalogFormApi;
    hasTemplate: () => boolean;
    manualNameOverride: () => boolean;
    setManualNameOverride: (v: boolean) => void;
}

export const IdentificationSection: Component<IdentificationSectionProps> = (props) => {
    return (
        <fieldset class="bg-card border border-border/90 rounded-xl p-4 sm:p-5 shadow-2xs flex flex-col gap-4">
            <div class="flex items-center justify-between">
                <h3 class="text-sm font-semibold text-text">Título y Descripción</h3>
            </div>

            {/* Title */}
            <props.form.Field name="title">
                {(field) => (
                    <TextField.Root field={field() as any}>
                        <TextField.Label>
                            <span class="flex items-center gap-2">
                                Título del Producto *
                                <Show when={props.hasTemplate()}>
                                    <Badge variant="info" class="text-[10px] px-1.5 py-0">Auto-generado</Badge>
                                </Show>
                            </span>
                        </TextField.Label>
                        <TextField.Input
                            type="text"
                            placeholder={props.hasTemplate() ? 'Se genera automáticamente desde los atributos...' : 'Título del producto (ej: Cable de Acero 1/2 pulgada)'}
                            readOnly={props.hasTemplate() && !props.manualNameOverride()}
                            class={`h-9 bg-surface border-border text-sm ${props.hasTemplate() && !props.manualNameOverride() ? 'bg-surface/60 cursor-default' : ''}`}
                        />
                        <TextField.ErrorMessage />
                    </TextField.Root>
                )}
            </props.form.Field>

            <Show when={props.hasTemplate() && !props.manualNameOverride()}>
                <button
                    type="button"
                    class="inline-flex items-center gap-1.5 text-xs text-primary hover:text-primary-strong transition-colors -mt-2 cursor-pointer w-fit"
                    onClick={() => props.setManualNameOverride(true)}
                >
                    <EditIcon class="size-3.5" />
                    <span>Editar nombre manualmente</span>
                </button>
            </Show>

            <Show when={props.hasTemplate() && props.manualNameOverride()}>
                <button
                    type="button"
                    class="inline-flex items-center gap-1.5 text-xs text-primary hover:text-primary-strong transition-colors -mt-2 cursor-pointer w-fit"
                    onClick={() => props.setManualNameOverride(false)}
                >
                    <RotateCcwIcon class="size-3.5" />
                    <span>Volver a nombre automático</span>
                </button>
            </Show>

            {/* Description */}
            <props.form.Field name="description">
                {(field) => (
                    <TextField.Root field={field()}>
                        <TextField.Label optional>Descripción</TextField.Label>
                        <TextField.TextArea
                            placeholder="Descripción técnica o comercial del producto..."
                            rows={3}
                            class="bg-surface border-border text-sm"
                        />
                    </TextField.Root>
                )}
            </props.form.Field>
        </fieldset>
    );
};

export default IdentificationSection;
