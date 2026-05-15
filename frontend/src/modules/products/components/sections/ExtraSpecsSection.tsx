/**
 * ExtraSpecsSection — Key-value editor for unstructured product specs.
 * Maps to the `extra_specs` JSONB field (manufacturer notes, technical links, etc.)
 */
import { Component, For, Show, createSignal } from 'solid-js';
import TextField from '@shared/ui/TextField';
import Button from '@shared/ui/Button';
import { PlusIcon, TrashIcon } from '@shared/ui/icons';
import SectionHeader from '../ui/SectionHeader';

interface ExtraSpecsSectionProps {
    form: any;
}

const ExtraSpecsSection: Component<ExtraSpecsSectionProps> = (props) => {
    const [newKey, setNewKey] = createSignal('');
    const [newValue, setNewValue] = createSignal('');

    const specs = () => {
        const raw = props.form.getFieldValue('extra_specs') as Record<string, unknown> | undefined;
        return raw ?? {};
    };

    const entries = () => Object.entries(specs()).filter(([_, v]) => v !== undefined);

    const addSpec = () => {
        const key = newKey().trim();
        const value = newValue().trim();
        if (!key) return;

        props.form.setFieldValue('extra_specs', {
            ...specs(),
            [key]: value,
        });
        setNewKey('');
        setNewValue('');
    };

    const removeSpec = (key: string) => {
        const current = { ...specs() };
        delete current[key];
        props.form.setFieldValue('extra_specs', current);
    };

    const updateSpec = (key: string, value: string) => {
        props.form.setFieldValue('extra_specs', {
            ...specs(),
            [key]: value,
        });
    };

    return (
        <fieldset class="space-y-4 bg-surface/30 p-5 rounded-2xl border border-border/40">
            <SectionHeader
                color="accent"
                title="Especificaciones Adicionales"
                description="Datos no estructurados: notas del fabricante, enlaces técnicos, fichas, etc."
            />

            {/* Existing entries */}
            <Show when={entries().length > 0}>
                <div class="space-y-2">
                    <For each={entries()}>
                        {([key, value]) => (
                            <div class="flex items-center gap-2 group">
                                <div class="w-1/3">
                                    <span class="text-xs font-mono font-semibold text-primary bg-primary/10 px-2 py-1 rounded-lg inline-block">
                                        {key}
                                    </span>
                                </div>
                                <div class="flex-1">
                                    <TextField.Root
                                        value={String(value ?? '')}
                                        onChange={(v) => updateSpec(key, v)}
                                    >
                                        <TextField.Input
                                            type="text"
                                            placeholder="Valor..."
                                            class="text-sm"
                                        />
                                    </TextField.Root>
                                </div>
                                <button
                                    type="button"
                                    class="p-1.5 rounded-lg text-danger/50 hover:text-danger hover:bg-danger/10 opacity-0 group-hover:opacity-100 transition-all shrink-0"
                                    onClick={() => removeSpec(key)}
                                    title="Eliminar"
                                >
                                    <TrashIcon class="size-3.5" />
                                </button>
                            </div>
                        )}
                    </For>
                </div>
            </Show>

            {/* Add new spec row */}
            <div class="flex items-end gap-2 pt-1">
                <div class="w-1/3">
                    <TextField.Root value={newKey()} onChange={setNewKey}>
                        <TextField.Label>Clave</TextField.Label>
                        <TextField.Input
                            type="text"
                            placeholder="Ej: ficha_tecnica"
                            class="text-sm font-mono"
                            onKeyDown={(e: KeyboardEvent) => e.key === 'Enter' && (e.preventDefault(), addSpec())}
                        />
                    </TextField.Root>
                </div>
                <div class="flex-1">
                    <TextField.Root value={newValue()} onChange={setNewValue}>
                        <TextField.Label>Valor</TextField.Label>
                        <TextField.Input
                            type="text"
                            placeholder="Ej: https://..."
                            class="text-sm"
                            onKeyDown={(e: KeyboardEvent) => e.key === 'Enter' && (e.preventDefault(), addSpec())}
                        />
                    </TextField.Root>
                </div>
                <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={addSpec}
                    disabled={!newKey().trim()}
                    icon={<PlusIcon class="size-3.5" />}
                >
                    Agregar
                </Button>
            </div>

            <Show when={entries().length === 0}>
                <p class="text-xs text-muted text-center py-2">
                    Sin especificaciones adicionales. Agrega pares clave-valor según necesites.
                </p>
            </Show>
        </fieldset>
    );
};

export default ExtraSpecsSection;
