/**
 * AttributeForm — Sheet form for creating/editing an attribute_definition.
 *
 * Design:
 * - Single-column flow with clear visual sections
 * - Interactive type picker cards with icons + descriptions
 * - DnD-reorderable SELECT options with empty state
 * - Read-only key display in edit mode (backend auto-generates key from label)
 *
 * Stack: TanStack Form + Valibot + solid-dnd + shared UI components
 */
declare module 'solid-js' {
    namespace JSX {
        interface Directives {
            sortable: true;
        }
    }
}

import { Component, createSignal, For, Show, createMemo, createEffect } from 'solid-js';
import { Dynamic } from 'solid-js/web';
import { createForm } from '@tanstack/solid-form';
import { valibotValidator } from '@tanstack/valibot-form-adapter';
import { AttributeFormSchema } from '@app/schema/frontend';
import type { AttributeFormData, AttributeDataType } from '@app/schema/frontend';
import TextField from '@shared/ui/TextField';
import Button from '@shared/ui/Button';
import { PlusIcon, CloseIcon, KeyIcon, GripVerticalIcon, TrashIcon } from '@shared/ui/icons';
import {
    DragDropProvider,
    DragDropSensors,
    SortableProvider,
    createSortable,
    closestCenter,
    transformStyle,
    DragOverlay,
    type DragEvent,
} from '@thisbeyond/solid-dnd';
import { FormSubmissionContext, hasFieldError, getFieldError } from '@shared/ui/form/form.types';
import { type AttributeDetail } from '../data/attributes.api';
import { ATTRIBUTE_TYPE_OPTIONS, type AttributeTypeOption } from '../data/attributes.constants';

export interface AttributeFormProps {
    attribute?: AttributeDetail | null;
    onSubmit: (data: AttributeFormData) => Promise<void>;
    isSubmitting: boolean;
}

// ── Type Picker Card ─────────────────────────────────────────────────
const TypeCard: Component<{
    option: AttributeTypeOption;
    isSelected: boolean;
    disabled: boolean;
    onSelect: () => void;
}> = (props) => {
    const colorMap: Record<string, { ring: string; bg: string; icon: string; text: string }> = {
        primary: { ring: 'ring-primary/60', bg: 'bg-primary/8', icon: 'text-primary', text: 'text-primary' },
        info:    { ring: 'ring-info/60',    bg: 'bg-info/8',    icon: 'text-info',    text: 'text-info' },
        warning: { ring: 'ring-warning/60', bg: 'bg-warning/8', icon: 'text-warning', text: 'text-warning' },
        success: { ring: 'ring-success/60', bg: 'bg-success/8', icon: 'text-success', text: 'text-success' },
    };
    const colors = () => colorMap[props.option.color] ?? colorMap.primary;

    return (
        <button
            type="button"
            onClick={() => !props.disabled && props.onSelect()}
            disabled={props.disabled}
            class={`
                relative flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all duration-200 cursor-pointer
                focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50
                ${props.disabled ? 'opacity-50 cursor-not-allowed' : ''}
                ${props.isSelected
                    ? `${colors().bg} ${colors().ring} ring-2 border-transparent shadow-sm`
                    : 'border-border/60 bg-card hover:border-border-strong hover:bg-surface/50'
                }
            `}
        >
            {/* Icon */}
            <div class={`
                size-10 rounded-lg flex items-center justify-center transition-colors duration-200
                ${props.isSelected ? `${colors().bg} ${colors().icon}` : 'bg-surface text-muted'}
            `}>
                <Dynamic component={props.option.icon} class="size-5" />
            </div>

            {/* Label */}
            <span class={`text-sm font-semibold transition-colors ${props.isSelected ? colors().text : 'text-text'}`}>
                {props.option.label}
            </span>

            {/* Description */}
            <span class="text-xs text-muted leading-tight text-center">
                {props.option.description}
            </span>

            {/* Selected indicator */}
            <Show when={props.isSelected}>
                <div class={`absolute top-2 right-2 size-2 rounded-full ${colors().icon.replace('text-', 'bg-')} animate-in fade-in zoom-in`} />
            </Show>
        </button>
    );
};

// ── Sortable Option Row (Metronic-style editable input row) ─────────
const SortableOption: Component<{
    option: string;
    index: number;
    onRemove: () => void;
    onChange: (oldVal: string, newVal: string) => void;
}> = (props) => {
    const sortable = createSortable(props.option);
    const [localValue, setLocalValue] = createSignal(props.option);

    // Sync if parent changes the option string
    createEffect(() => setLocalValue(props.option));

    const handleBlur = () => {
        const val = localValue().trim();
        if (val && val !== props.option) {
            props.onChange(props.option, val);
        } else {
            setLocalValue(props.option); // Revert if empty or unchanged
        }
    };

    return (
        <div
            use:sortable
            style={{
                ...transformStyle(sortable.transform),
                transition: sortable.transform ? 'transform 0ms' : 'transform 200ms cubic-bezier(0.25, 1, 0.5, 1)',
                "z-index": sortable.isActiveDraggable ? 10 : 1,
            }}
            class={`
                group/opt flex items-center gap-2 transition-all select-none
                ${sortable.isActiveDraggable
                    ? 'scale-[1.02] opacity-95 shadow-lg rounded-lg bg-card'
                    : ''
                }
            `}
        >
            {/* Grip handle */}
            <div 
                {...sortable.dragActivators}
                class={`p-2 rounded-md cursor-grab active:cursor-grabbing transition-colors flex items-center justify-center shrink-0 ${
                    sortable.isActiveDraggable ? 'text-primary bg-primary/10' : 'text-muted/40 hover:text-text hover:bg-surface'
                }`}
            >
                <GripVerticalIcon class="size-4" />
            </div>

            {/* Editable Input field */}
            <div class="flex-1 relative flex items-center">
                <input
                    type="text"
                    value={localValue()}
                    onInput={(e) => setLocalValue(e.currentTarget.value)}
                    onBlur={handleBlur}
                    onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
                    onPointerDown={(e) => e.stopPropagation()} // Prevent DnD from stealing focus
                    class={`
                        w-full h-10 px-3 rounded-lg border text-sm font-medium transition-all focus:outline-none focus:ring-2 focus:ring-primary/20
                        ${sortable.isActiveDraggable
                            ? 'bg-primary/5 border-primary/40 text-primary pointer-events-none'
                            : 'bg-card border-border/80 text-text hover:border-border-strong focus:border-primary'
                        }
                    `}
                />
            </div>

            {/* Trash button */}
            <button
                type="button"
                onClick={(e) => { e.preventDefault(); e.stopPropagation(); props.onRemove(); }}
                onPointerDown={(e) => e.stopPropagation()} // Prevent DnD
                class="p-2 text-muted/40 hover:text-danger hover:bg-danger/10 rounded-lg transition-colors focus:outline-none shrink-0 cursor-pointer"
                title="Eliminar opción"
            >
                <TrashIcon class="size-4" />
            </button>
        </div>
    );
};

// ── Main Form ────────────────────────────────────────────────────────
const AttributeForm: Component<AttributeFormProps> = (props) => {
    const isEditing = () => !!props.attribute;
    const [hasAttemptedSubmit, setHasAttemptedSubmit] = createSignal(false);

    // Track option renames: originalValue → currentValue
    // Handles chained renames (A→B→C becomes A→C) and reverts
    const [renames, setRenames] = createSignal<Map<string, string>>(new Map());

    const form = createForm(() => ({
        defaultValues: {
            label: props.attribute?.label ?? '',
            type: (props.attribute?.type as AttributeDataType) ?? 'TEXT',
            defaultOptions: props.attribute?.default_options ?? [],
            renamedOptions: [] as Array<{ from: string; to: string }>,
        } as AttributeFormData,
        validatorAdapter: valibotValidator(),
        validators: {
            onChange: AttributeFormSchema,
            onSubmit: AttributeFormSchema,
        },
        onSubmit: async ({ value }) => {
            // Attach accumulated renames to the submission
            const renameEntries = Array.from(renames().entries())
                .map(([from, to]) => ({ from, to }))
                .filter(r => r.from !== r.to);
            await props.onSubmit({
                ...value,
                renamedOptions: renameEntries.length > 0 ? renameEntries : undefined,
            } as AttributeFormData);
        },
    }));

    const typeValue = form.useStore((s) => s.values.type);
    const optionsValue = form.useStore((s) => s.values.defaultOptions);

    const showOptionsInput = createMemo(() => typeValue() === 'SELECT' || typeValue() === 'TEXT');
    const isSelectType = createMemo(() => typeValue() === 'SELECT');
    const optionsCount = createMemo(() => (optionsValue() ?? []).length);

    // Dropdown options management
    const [newOption, setNewOption] = createSignal('');
    let optionInputRef: HTMLInputElement | undefined;

    const handleAddOption = (e?: Event) => {
        e?.preventDefault();
        const val = newOption().trim();
        if (!val) return;

        const currentOpts = form.getFieldValue('defaultOptions') ?? [];
        if (!currentOpts.includes(val)) {
            form.setFieldValue('defaultOptions', [...currentOpts, val]);
        }
        setNewOption('');
        optionInputRef?.focus();
    };

    const handleRemoveOption = (opt: string) => {
        const currentOpts = form.getFieldValue('defaultOptions') ?? [];
        form.setFieldValue('defaultOptions', (currentOpts as string[]).filter((o) => o !== opt));
    };

    const handleEditOption = (oldVal: string, newVal: string) => {
        const currentOpts = [...(form.getFieldValue('defaultOptions') ?? [])];
        const index = currentOpts.indexOf(oldVal);
        if (index !== -1) {
            // Check for duplicates
            if (currentOpts.includes(newVal) && newVal !== oldVal) return;
            currentOpts[index] = newVal;
            form.setFieldValue('defaultOptions', currentOpts);

            // Track rename for cascade (only when editing existing attributes)
            if (isEditing()) {
                setRenames(prev => {
                    const next = new Map(prev);
                    // Check if oldVal was already a rename target (chained: A→B→C becomes A→C)
                    const originalKey = [...next.entries()].find(([_, v]) => v === oldVal)?.[0];
                    if (originalKey !== undefined) {
                        // Update the original rename to point to the new value
                        if (originalKey === newVal) {
                            // Reverted to original — remove from map
                            next.delete(originalKey);
                        } else {
                            next.set(originalKey, newVal);
                        }
                    } else {
                        // First rename of this option
                        next.set(oldVal, newVal);
                    }
                    return next;
                });
            }
        }
    };

    const onDragEnd = (event: DragEvent) => {
        if (event.draggable && event.droppable) {
            const currentOpts = (form.getFieldValue('defaultOptions') ?? []) as string[];
            const fromIndex = currentOpts.indexOf(event.draggable.id as string);
            const toIndex = currentOpts.indexOf(event.droppable.id as string);

            if (fromIndex !== -1 && toIndex !== -1 && fromIndex !== toIndex) {
                const newOpts = [...currentOpts];
                newOpts.splice(toIndex, 0, newOpts.splice(fromIndex, 1)[0]);
                form.setFieldValue('defaultOptions', newOpts);
            }
        }
    };

    return (
        <FormSubmissionContext.Provider value={hasAttemptedSubmit}>
            <form
                id="attribute-form"
                onSubmit={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setHasAttemptedSubmit(true);
                    form.handleSubmit();
                }}
                class="flex flex-col gap-5"
            >
                {/* ─── Section 1: Identity ─── */}
                <section class="space-y-5">
                    {/* Read-only key in edit mode */}
                    <Show when={isEditing() && props.attribute?.key}>
                        <div class="flex items-center gap-3 px-3.5 py-2.5 rounded-lg bg-surface/60 border border-border/50 mb-4">
                            <div class="size-8 rounded-md bg-card-alt flex items-center justify-center shrink-0">
                                <KeyIcon class="size-4 text-muted" />
                            </div>
                            <div class="flex flex-col min-w-0">
                                <span class="text-[11px] text-muted font-medium uppercase tracking-wider">Clave Interna</span>
                                <span class="text-sm font-mono text-text truncate select-all">{props.attribute!.key}</span>
                            </div>
                        </div>
                    </Show>

                    {/* Label field */}
                    <form.Field name="label">
                        {(field) => (
                            <TextField.Root field={field()} class='mt-4 gap-2'>
                                <TextField.Label class='text-text text-sm font-semibold' >Etiqueta *</TextField.Label>
                                <TextField.Input type="text" placeholder="Ej: Voltaje de Entrada, Color, Talla..." />
                                <TextField.ErrorMessage />
                            </TextField.Root>
                        )}
                    </form.Field>
                </section>

                {/* ─── Section 2: Type Picker ─── */}
                <section class="space-y-3">
                    <div class="flex items-center gap-2">
                        <h3 class="ml-1 text-sm font-semibold text-text tracking-wide">Tipo de Datos</h3>
                        <Show when={isEditing()}>
                            <span class="text-[10px] bg-surface border border-border px-2 py-0.5 rounded-full text-muted font-medium ml-auto">
                                No modificable
                            </span>
                        </Show>
                    </div>

                    <form.Field name="type">
                        {(field) => (
                            <>
                                <div class="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                    <For each={ATTRIBUTE_TYPE_OPTIONS}>
                                        {(opt) => (
                                            <TypeCard
                                                option={opt}
                                                isSelected={field().state.value === opt.value}
                                                disabled={isEditing()}
                                                onSelect={() => field().handleChange(opt.value)}
                                            />
                                        )}
                                    </For>
                                </div>
                                <Show when={hasFieldError(field())}>
                                    <span class="text-xs font-medium text-danger">
                                        {getFieldError(field())}
                                    </span>
                                </Show>
                            </>
                        )}
                    </form.Field>
                </section>

                {/* ─── Section 3: Options (conditional) ─── */}
                <Show when={showOptionsInput()}>
                    <section class="animate-in fade-in slide-in-from-top-2 duration-300 mt-2 mb-4">
                        <fieldset class={`
                            rounded-xl border-2 bg-surface/10 pb-2 relative transition-colors
                           border-border/60 hover:border-border-strong
                        `}>
                            <legend class="ml-4 px-2 text-sm font-semibold text-text flex items-center gap-2 bg-background">
                                {isSelectType() ? 'Opciones Disponibles' : 'Valores Sugeridos'}
                                <Show when={optionsCount() > 0}>
                                    <span class="text-[10px] bg-surface border border-border text-text font-bold px-1.5 py-0.5 rounded-full tabular-nums shadow-sm">
                                        {optionsCount()}
                                    </span>
                                </Show>
                                <Show when={isSelectType()}>
                                    <span class="text-text ml-0.5 font-bold" title="Requerido">*</span>
                                </Show>
                            </legend>

                            <div class="flex flex-col gap-3 px-4 pt-1">
                                {/* Add option input */}
                                <div class="flex items-center gap-2 mt-1">
                                    <div class="relative flex-1">
                                        <input
                                            ref={optionInputRef!}
                                            id="new-opt-input"
                                            type="text"
                                            value={newOption()}
                                            onInput={(e) => setNewOption(e.currentTarget.value)}
                                            onKeyDown={(e) => e.key === 'Enter' && handleAddOption(e)}
                                            placeholder="Escribe una opción y presiona Enter..."
                                            class="w-full h-10 pl-3 pr-14 rounded-lg border border-border/80 bg-card text-sm text-text focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all placeholder:text-muted/50 shadow-sm"
                                        />
                                        <div class="absolute right-2 top-1/2 -translate-y-1/2 text-muted/40 pointer-events-none">
                                            <span class="text-[10px] font-mono border border-border/50 rounded px-1.5 py-0.5 bg-surface/50">↵ Enter</span>
                                        </div>
                                    </div>
                                    <Button
                                        type="button"
                                        variant="secondary"
                                        size="md"
                                        onClick={handleAddOption}
                                        disabled={!newOption().trim()}
                                        class="h-10 px-4 rounded-lg font-medium shadow-sm shrink-0"
                                        icon={<PlusIcon class="size-4" />}
                                    >
                                        Agregar
                                    </Button>
                                </div>

                                {/* DnD options list */}
                                <div class="min-h-[60px] py-2">
                                    <DragDropProvider
                                        onDragEnd={onDragEnd}
                                        collisionDetector={closestCenter}
                                    >
                                        <DragDropSensors />
                                        <Show
                                            when={optionsCount() > 0}
                                            fallback={
                                                <div class="flex flex-col items-center justify-center py-5 text-center border-2 border-dashed border-border/50 rounded-xl bg-surface/30 transition-colors">
                                                    <div class="text-2xl mb-2 opacity-40">📋</div>
                                                    <p class="text-sm text-text font-medium">Sin opciones agregadas</p>
                                                    <p class="text-[11px] text-muted mt-1 max-w-[220px]">
                                                        {isSelectType() 
                                                            ? 'Debes agregar al menos una opción obligatoria para este tipo.' 
                                                            : 'Agrega valores sugeridos para autocompletar rápidamente.'}
                                                    </p>
                                                </div>
                                            }
                                        >
                                            <SortableProvider ids={optionsValue() ?? []}>
                                                <div class="flex flex-col gap-1.5">
                                                    <For each={optionsValue() ?? []}>
                                                        {(opt, i) => (
                                                            <SortableOption
                                                                option={opt}
                                                                index={i()}
                                                                onRemove={() => handleRemoveOption(opt)}
                                                                onChange={handleEditOption}
                                                            />
                                                        )}
                                                    </For>
                                                </div>
                                            </SortableProvider>
                                        </Show>
                                        <DragOverlay>
                                            {(draggable) => {
                                                if (!draggable) return null;
                                                return (
                                                    <div class="flex items-center gap-2 pointer-events-none cursor-grabbing">
                                                        <GripVerticalIcon class="size-4 text-primary shrink-0" />
                                                        <div class="flex-1 h-10 flex items-center px-3 rounded-lg border-2 border-primary/50 bg-primary/5 text-sm font-medium text-primary shadow-2xl">
                                                            <span class="truncate">{draggable.id}</span>
                                                        </div>
                                                        <div class="p-2 shrink-0"><TrashIcon class="size-4 text-muted/30" /></div>
                                                    </div>
                                                );
                                            }}
                                        </DragOverlay>
                                    </DragDropProvider>
                                </div>

                                {/* Hint footer */}
                                <Show when={optionsCount() > 1}>
                                    <div class="flex items-center justify-center gap-2 pt-2 pb-1 border-t border-border/30 text-muted/60 text-[11px]">
                                        <GripVerticalIcon class="size-3 opacity-60" />
                                        <span>Arrastra para reordenar las opciones</span>
                                    </div>
                                </Show>
                            </div>
                        </fieldset>

                        {/* Validation error for options */}
                        <form.Field name="defaultOptions">
                            {(field) => (
                                <Show when={hasFieldError(field())}>
                                    <span class="text-xs font-medium text-danger block ml-2 mt-1">
                                        {getFieldError(field())}
                                    </span>
                                </Show>
                            )}
                        </form.Field>
                    </section>
                </Show>
            </form>
        </FormSubmissionContext.Provider>
    );
};

export default AttributeForm;
