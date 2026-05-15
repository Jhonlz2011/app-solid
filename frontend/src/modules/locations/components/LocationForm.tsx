/**
 * LocationForm — Shared form for Location create/edit.
 *
 * Features:
 * - Parent Autocomplete with tree-indent + breadcrumbs (like CategoryForm)
 * - Type selector with icon badges
 * - Barcode field (hidden for VIEW type — views don't get scanned)
 * - Smart warehouse inheritance from parent
 */
import { Component, Show, createSignal, createMemo, createEffect } from 'solid-js';
import { Dynamic } from 'solid-js/web';
import type { LocationType } from '@app/schema/enums';
import { locationTypeOptions, LOCATION_TYPE_META } from '../data/locations.constants';
import { useLocationList } from '../data/locations.queries';
import type { LocationItem } from '../data/locations.api';
import { FormSubmissionContext } from '@shared/ui/form/form.types';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@shared/ui/Select';
import { Autocomplete } from '@shared/ui/Autocomplete';
import { FieldLabel } from '@shared/ui/TextField';
import TextField from '@shared/ui/TextField';
import { SkeletonLoader } from '@shared/ui/SkeletonLoader';
import { MapPinIcon } from '@shared/ui/icons';
import { cn } from '@shared/lib/utils';

type TypeOption = { value: string; label: string; icon: Component<any> };

interface LocationFormProps {
    form: any;
    formId: string;
    hasAttemptedSubmit: () => boolean;
    disabled?: boolean;
    /** Pre-selected parent for "Add child" flow */
    defaultParentId?: number;
    /** ID of the location being edited (to exclude from parent options) */
    editingId?: number;
}

const LocationForm: Component<LocationFormProps> = (props) => {
    const isDisabled = () => props.disabled ?? false;

    // Query for parent autocomplete
    const locationsQuery = useLocationList();
    const [parentSearch, setParentSearch] = createSignal('');

    // Current type value (reactive)
    const currentType = props.form.useStore((s: any) => s.values.type);

    // Parent options: exclude self and inactive (except current parent when editing)
    const parentOptions = createMemo(() => {
        const flat = (locationsQuery.data ?? []) as LocationItem[];
        if (!props.editingId) return flat.filter(l => (l.is_active ?? true));
        return flat.filter(l => l.id !== props.editingId && (l.is_active ?? true));
    });

    // Filtered options for autocomplete search
    const filteredParentOptions = createMemo(() => {
        const search = parentSearch().toLowerCase().trim();
        if (!search) return parentOptions();
        return parentOptions().filter(l =>
            l.name.toLowerCase().includes(search) ||
            l.path.toLowerCase().includes(search)
        );
    });

    // Depth map for indent in dropdown
    const depthMap = createMemo(() => {
        const map = new Map<number, number>();
        const flat = (locationsQuery.data ?? []) as LocationItem[];
        for (const l of flat) {
            map.set(l.id, l.depth ?? 0);
        }
        return map;
    });

    // Children set for icon styling
    const childrenSet = createMemo(() => {
        const set = new Set<number>();
        const flat = (locationsQuery.data ?? []) as LocationItem[];
        for (const l of flat) {
            if (l.parent_id) set.add(l.parent_id);
        }
        return set;
    });

    // Build breadcrumb path for a location
    const getBreadcrumb = (id: number): string => {
        const flatMap = new Map<number, LocationItem>();
        for (const l of (locationsQuery.data ?? []) as LocationItem[]) {
            flatMap.set(l.id, l);
        }
        const parts: string[] = [];
        let current = flatMap.get(id);
        if (current?.parent_id) {
            current = flatMap.get(current.parent_id);
        } else {
            return '';
        }
        while (current) {
            parts.unshift(current.name);
            current = current.parent_id ? flatMap.get(current.parent_id) : undefined;
        }
        return parts.join(' › ');
    };

    const getParentDisplayText = (parentId: number | undefined): string => {
        if (!parentId) return '';
        const loc = parentOptions().find(l => l.id === parentId);
        if (!loc) return '';
        const breadcrumb = getBreadcrumb(loc.id);
        return breadcrumb ? `${loc.name} (${breadcrumb})` : loc.name;
    };

    // Set default parent on mount
    createEffect(() => {
        if (props.defaultParentId) {
            props.form.setFieldValue('parent_id', props.defaultParentId);
            setParentSearch(getParentDisplayText(props.defaultParentId));
            queueMicrotask(() => {
                props.form.setFieldMeta('parent_id', (prev: any) => ({ ...prev, isTouched: false }));
            });
        }
    });

    return (
        <FormSubmissionContext.Provider value={props.hasAttemptedSubmit}>
            <form
                id={props.formId}
                onSubmit={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    props.form.handleSubmit();
                }}
                class="flex flex-col gap-5 py-2"
            >
                {/* 1. Name */}
                <props.form.Field name="name">
                    {(field: any) => (
                        <TextField.Root field={field()} disabled={isDisabled()}>
                            <TextField.Label>Nombre *</TextField.Label>
                            <TextField.Input
                                type="text"
                                placeholder="Estante A1, Zona de Recepción..."
                            />
                            <TextField.ErrorMessage />
                        </TextField.Root>
                    )}
                </props.form.Field>

                {/* 2. Parent Autocomplete */}
                <props.form.Field name="parent_id">
                    {(field: any) => (
                        <div class="space-y-1.5 flex flex-col items-start w-full min-w-0 max-w-full">
                            <Show
                                when={!locationsQuery.isLoading}
                                fallback={
                                    <>
                                        <FieldLabel>Ubicación Padre</FieldLabel>
                                        <SkeletonLoader type="text" class="h-10 w-full" />
                                    </>
                                }
                            >
                                <Autocomplete.Root field={field()}>
                                    <Autocomplete.Label>Ubicación Padre</Autocomplete.Label>
                                    <Autocomplete.Input<LocationItem>
                                        value={parentSearch()}
                                        onInputChange={setParentSearch}
                                        options={filteredParentOptions()}
                                        optionValue={(loc) => String(loc.id)}
                                        optionLabel={(loc) => loc.name}
                                        placeholder="Buscar ubicación padre..."
                                        hideEmptyState={false}
                                        minLength={0}
                                        disabled={isDisabled()}
                                        onSelect={(loc) => {
                                            if (loc) {
                                                field().handleChange(loc.id);
                                                const breadcrumb = getBreadcrumb(loc.id);
                                                setParentSearch(breadcrumb ? `${loc.name} (${breadcrumb})` : loc.name);
                                            } else {
                                                field().handleChange(undefined);
                                                setParentSearch('');
                                            }
                                        }}
                                        itemRenderer={(loc) => {
                                            const depth = depthMap().get(loc.id) ?? 0;
                                            const hasKids = childrenSet().has(loc.id);
                                            const breadcrumb = getBreadcrumb(loc.id);

                                            return (
                                                <div
                                                    class="flex items-center gap-2.5 min-w-0 py-0.5"
                                                    style={{ "padding-left": `${depth * 16}px` }}
                                                >
                                                    <MapPinIcon
                                                        class={cn(
                                                            "size-4 shrink-0",
                                                            hasKids ? "text-blue-500" : "text-muted/40"
                                                        )}
                                                    />
                                                    <div class="flex flex-col min-w-0">
                                                        <span class="text-sm font-medium text-text truncate">
                                                            {loc.name}
                                                        </span>
                                                        <Show when={breadcrumb}>
                                                            <span class="text-[11px] text-muted/70 truncate leading-tight">
                                                                {breadcrumb}
                                                            </span>
                                                        </Show>
                                                    </div>
                                                </div>
                                            );
                                        }}
                                    />
                                    <Autocomplete.ErrorMessage />
                                    <Autocomplete.Description>
                                        Deja vacío para crear como ubicación raíz
                                    </Autocomplete.Description>
                                </Autocomplete.Root>
                            </Show>
                        </div>
                    )}
                </props.form.Field>

                {/* 3. Type Select */}
                <props.form.Field name="type">
                    {(field: any) => (
                        <div class="space-y-1.5">
                            <FieldLabel>Tipo *</FieldLabel>
                            <Select
                                value={locationTypeOptions.find(o => o.value === field().state.value)}
                                onChange={(opt: any) => {
                                    if (opt) field().handleChange(opt.value);
                                }}
                                options={locationTypeOptions}
                                optionValue="value"
                                optionTextValue="label"
                                placeholder="Seleccionar tipo..."
                                disabled={isDisabled()}
                                itemComponent={(itemProps: any) => (
                                    <SelectItem item={itemProps.item}>
                                        <TypeOptionLabel
                                            value={itemProps.item.rawValue.value}
                                            label={itemProps.item.rawValue.label}
                                        />
                                    </SelectItem>
                                )}
                            >
                                <SelectTrigger>
                                    <SelectValue<TypeOption>>
                                        {(state: any) => {
                                            const opt = state.selectedOption();
                                            if (!opt) return <span class="text-muted">Seleccionar tipo...</span>;
                                            return <TypeOptionLabel value={opt.value} label={opt.label} />;
                                        }}
                                    </SelectValue>
                                </SelectTrigger>
                                <SelectContent />
                            </Select>
                        </div>
                    )}
                </props.form.Field>

                {/* 4. Barcode — only for INTERNAL type (VIEW locations don't get scanned) */}
                <Show when={currentType() !== 'VIEW'}>
                    <props.form.Field name="barcode">
                        {(field: any) => (
                            <TextField.Root field={field()} disabled={isDisabled()}>
                                <TextField.Label>Código de Barras</TextField.Label>
                                <TextField.Input
                                    type="text"
                                    placeholder="Escanear o ingresar código..."
                                    class="font-mono"
                                    maxLength={50}
                                />
                                <TextField.ErrorMessage />
                            </TextField.Root>
                        )}
                    </props.form.Field>
                </Show>
            </form>
        </FormSubmissionContext.Provider>
    );
};

/** Renders a type option with its icon */
const TypeOptionLabel: Component<{ value?: string; label?: string }> = (props) => {
    const meta = () => props.value ? LOCATION_TYPE_META[props.value as LocationType] : null;

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

export default LocationForm;
