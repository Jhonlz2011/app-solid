/**
 * UomForm.tsx — Self-contained, decoupled form for Units of Measure (UOM)
 * 
 * Uses TanStack Form v1 with native Standard Schema (Valibot v1).
 */
import { Component, createMemo, Show, createSignal } from 'solid-js';
import { Dynamic } from 'solid-js/web';
import { createForm } from '@tanstack/solid-form';
import { UomFormSchema, type UomFormData } from '@app/schema/frontend';
import type { UomGroup } from '@app/schema/enums';
import { groupOptions, UOM_GROUP_META } from '../data/uom.constants';
import { FormSubmissionContext } from '@shared/ui/form/form.types';
import { handleFormApiErrors } from '@shared/utils/form.utils';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@form/Select';
import { FieldLabel } from '@form/TextField';
import TextField from '@form/TextField';
import { useUomList } from '../data/uom.queries';
import { AlertTriangleIcon } from '@icons/AlertTriangleIcon';
import type { UomItem } from '../data/uom.api';

type GroupOption = { value: string; label: string; icon: Component<any> };

export interface UomFormProps {
    uom?: UomItem | null;
    onSubmit: (data: UomFormData) => Promise<void>;
    isSubmitting: boolean;
    formId: string;
    disabled?: boolean;
    disableCode?: boolean;
    codePlaceholder?: string;
}

export const UomForm: Component<UomFormProps> = (props) => {
    const isDisabled = () => props.disabled ?? false;
    const uomsQuery = useUomList();
    const [hasAttemptedSubmit, setHasAttemptedSubmit] = createSignal(false);
    const [invertMode, setInvertMode] = createSignal(false);

    const initialValues = (): UomFormData => ({
        code: props.uom?.code ?? '',
        name: props.uom?.name ?? '',
        uom_group: (props.uom?.uom_group as UomGroup) ?? 'CANTIDAD',
        base_factor: props.uom?.base_factor ? String(props.uom.base_factor) : '1',
    });

    const form = createForm(() => ({
        defaultValues: initialValues(),
        validators: {
            onChange: UomFormSchema,
            onSubmit: UomFormSchema,
        },
        onSubmit: async ({ value }) => {
            try {
                await props.onSubmit(value);
            } catch (err) {
                handleFormApiErrors(form, err, 'Error al guardar la unidad de medida', props.formId);
            }
        },
    }));

    return (
        <FormSubmissionContext.Provider value={hasAttemptedSubmit}>
            <form
                id={props.formId}
                onSubmit={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setHasAttemptedSubmit(true);
                    form.handleSubmit();
                }}
                class="space-y-4 py-2"
            >
                {/* 1. Group Select */}
                <form.Field name="uom_group">
                    {(field) => (
                        <div class="space-y-1.5">
                            <FieldLabel>Grupo de Magnitud *</FieldLabel>
                            <Select
                                value={groupOptions.find(o => o.value === field().state.value)}
                                onChange={(opt: any) => {
                                    if (opt) {
                                        field().handleChange(opt.value);
                                        // Smart default si selecciona CANTIDAD y está vacío
                                        if (opt.value === 'CANTIDAD' && !form.state.values.code && !form.state.values.base_factor) {
                                            form.setFieldValue('base_factor', '1');
                                        }
                                    }
                                }}
                                options={groupOptions}
                                optionValue="value"
                                optionTextValue="label"
                                placeholder="Seleccionar grupo..."
                                disabled={isDisabled() || props.isSubmitting}
                                itemComponent={(itemProps: any) => (
                                    <SelectItem item={itemProps.item}>
                                        <GroupOptionLabel
                                            value={itemProps.item.rawValue.value}
                                            label={itemProps.item.rawValue.label}
                                        />
                                    </SelectItem>
                                )}
                            >
                                <SelectTrigger>
                                    <SelectValue<GroupOption>>
                                        {(state: any) => {
                                            const opt = state.selectedOption();
                                            if (!opt) return <span class="text-muted">Seleccionar grupo...</span>;
                                            return <GroupOptionLabel value={opt.value} label={opt.label} />;
                                        }}
                                    </SelectValue>
                                </SelectTrigger>
                                <SelectContent />
                            </Select>
                        </div>
                    )}
                </form.Field>

                {/* 2. Code + Name row */}
                <div class="grid grid-cols-[8rem_1fr] gap-4">
                    <form.Field name="code">
                        {(field) => (
                            <TextField.Root field={field()} disabled={isDisabled() || props.disableCode || props.isSubmitting}>
                                <TextField.Label>Código {props.disableCode ? '' : '*'}</TextField.Label>
                                <TextField.Input
                                    type="text"
                                    placeholder={props.codePlaceholder ?? 'UND'}
                                    class="uppercase font-mono"
                                    maxLength={10}
                                />
                                <TextField.ErrorMessage />
                            </TextField.Root>
                        )}
                    </form.Field>
                    <form.Field name="name">
                        {(field) => (
                            <TextField.Root field={field()} disabled={isDisabled() || props.isSubmitting}>
                                <TextField.Label>Nombre *</TextField.Label>
                                <TextField.Input type="text" placeholder="Unidad, Kilogramo, Metro..." />
                                <TextField.ErrorMessage />
                            </TextField.Root>
                        )}
                    </form.Field>
                </div>

                {/* 3. Base Factor (Equivalencia) */}
                <form.Subscribe selector={(state) => ({
                    group: state.values.uom_group,
                    code: state.values.code,
                    name: state.values.name,
                    factorStr: state.values.base_factor
                })}>
                    {(values) => {
                        const baseUnit = createMemo(() => {
                            const vals = values();
                            return (uomsQuery.data ?? []).find((u: any) => u.uom_group === vals.group && u.is_system === true && Number(u.base_factor) === 1) || null;
                        });

                        const currentCode = createMemo(() => (values().code || '???').toUpperCase());
                        const currentName = createMemo(() => values().name || 'Nueva Unidad');
                        const baseCode = createMemo(() => baseUnit()?.code || 'BASE');
                        const baseName = createMemo(() => baseUnit()?.name || 'Unidad Base');

                        return (
                            <div class="mt-6">
                                <div class="mb-3">
                                    <h3 class="text-[15px] font-semibold text-heading">
                                        Factor de Conversión
                                    </h3>
                                    <p class="text-sm text-muted mt-0.5">
                                        Establece a cuánto equivale la nueva unidad respecto a la base.
                                    </p>
                                </div>

                                {/* Conversor Interactivo */}
                                <div class="relative bg-surface border border-border shadow-sm rounded-xl p-2 flex flex-col sm:flex-row items-stretch gap-1">
                                    {/* Lado Izquierdo (Fijo en 1) */}
                                    <div class="flex-1 flex items-center gap-3 bg-card-alt rounded-lg p-2 border border-border-strong/50 min-w-0">
                                        <div class="flex items-center justify-center bg-surface border border-border shadow-sm h-11 w-11 rounded-lg font-mono text-xl font-bold text-primary shrink-0">
                                            1
                                        </div>
                                        <div class="flex flex-col min-w-0 flex-1">
                                            <span class="text-sm font-semibold text-text truncate w-full block" title={invertMode() ? baseName() : currentName()}>
                                                {invertMode() ? baseName() : currentName()}
                                            </span>
                                            <span class="text-xs font-mono text-muted mt-0.5 truncate w-full block">
                                                {invertMode() ? baseCode() : currentCode()}
                                            </span>
                                        </div>
                                    </div>

                                    {/* Botón Central (Swap) */}
                                    <div class="flex items-center justify-center sm:px-1 py-1 relative z-10 shrink-0">
                                        <div class="absolute inset-x-0 top-1/2 -translate-y-1/2 h-px bg-border sm:hidden"></div>
                                        <button 
                                            type="button" 
                                            onClick={() => setInvertMode(!invertMode())}
                                            class="relative flex items-center justify-center h-10 w-10 rounded-full bg-surface border border-border-strong shadow-sm text-muted hover:text-primary hover:border-primary/50 hover:bg-card-alt transition-all focus:outline-none focus:ring-4 focus:ring-primary-soft shrink-0"
                                            title="Invertir dirección"
                                        >
                                            <svg class="size-4.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                                                <path d="M16 3l4 4-4 4" />
                                                <path d="M20 7H4" />
                                                <path d="M8 21l-4-4 4-4" />
                                                <path d="M4 17h16" />
                                            </svg>
                                        </button>
                                    </div>

                                    {/* Lado Derecho (Input) */}
                                    <div class="flex-1 flex items-center gap-2 bg-surface rounded-lg p-2 border border-border-strong shadow-sm focus-within:ring-2 focus-within:ring-primary-soft focus-within:border-primary min-w-0">
                                        <form.Field name="base_factor">
                                            {(field) => {
                                                const displayValue = createMemo(() => {
                                                    const formValue = field().state.value;
                                                    if (!formValue) return "";
                                                    
                                                    const num = parseFloat(String(formValue).replace(',', '.'));
                                                    if (isNaN(num)) return String(formValue);
                                                    
                                                    if (!invertMode()) {
                                                        const rounded = Math.round(num);
                                                        return Math.abs(num - rounded) < 0.000001 ? rounded.toString() : num.toString();
                                                    } else {
                                                        const inv = 1 / num;
                                                        const rounded = Math.round(inv);
                                                        return Math.abs(inv - rounded) < 0.000001 ? rounded.toString() : inv.toFixed(8).replace(/\.?0+$/, '');
                                                    }
                                                });

                                                const handleChange = (val: string | number | null) => {
                                                    if (val === null || val === '') {
                                                        field().handleChange('');
                                                        return;
                                                    }
                                                    
                                                    const strVal = String(val);
                                                    const num = parseFloat(strVal.replace(',', '.'));
                                                    
                                                    if (isNaN(num) || num === 0) {
                                                        field().handleChange(strVal);
                                                    } else {
                                                        if (!invertMode()) {
                                                            field().handleChange(strVal);
                                                        } else {
                                                            field().handleChange(String(1 / num));
                                                        }
                                                    }
                                                };

                                                return (
                                                    <div class="flex-1 relative max-w-[60%] min-w-16">
                                                        <TextField.Root 
                                                            value={displayValue()}
                                                            onChange={handleChange}
                                                            validationState={field().state.meta.errors.length > 0 ? 'invalid' : 'valid'}
                                                            disabled={isDisabled() || props.isSubmitting}
                                                        >
                                                            <TextField.NumericInput 
                                                                allowNegative={false}
                                                                placeholder="1.0" 
                                                                class="rounded-md px-2 text-xl font-bold text-center min-w-0"
                                                            />
                                                        </TextField.Root>
                                                    </div>
                                                );
                                            }}
                                        </form.Field>

                                        <div class="flex flex-col px-2 border-l border-border min-w-0 shrink max-w-40">
                                            <span class="text-sm font-semibold text-text truncate w-full block" title={invertMode() ? currentName() : baseName()}>
                                                {invertMode() ? currentName() : baseName()}
                                            </span>
                                            <span class="text-xs font-mono text-muted mt-0.5 truncate w-full block">
                                                {invertMode() ? currentCode() : baseCode()}
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                {/* Error de validación */}
                                <form.Field name="base_factor">
                                    {(field) => (
                                        <Show when={field().state.meta.errors.length > 0}>
                                            <div class="mt-2 text-[13px] text-danger font-medium flex items-center gap-1.5">
                                                <AlertTriangleIcon class="size-4" />
                                                {field().state.meta.errors.map((e: any) => typeof e === 'string' ? e : e?.message || String(e)).join(', ')}
                                            </div>
                                        </Show>
                                    )}
                                </form.Field>
                            </div>
                        );
                    }}
                </form.Subscribe>
            </form>
        </FormSubmissionContext.Provider>
    );
};

/** Renders a group option with its icon */
const GroupOptionLabel: Component<{ value?: string; label?: string }> = (props) => {
    const meta = () => props.value ? UOM_GROUP_META[props.value as UomGroup] : null;

    return (
        <span class="flex items-center gap-2">
            {(() => {
                const m = meta();
                if (!m) return null;
                const Icon = m.icon;
                return <Dynamic component={Icon} class={`size-4 ${m.color.split(' ')[0]}`} />;
            })()}
            <span>{props.label ?? props.value}</span>
        </span>
    );
};