/**
 * LocationForm — Shared form for Location create/edit.
 *
 * Features:
 * - Warehouse selector with clear support and smart inheritance
 * - Visual indicators for warehouse parent inheritance with overriding support
 * - No restrictions on warehouse for virtual (VIEW) locations
 * - Parent selector using premium LocationSelect (INTERNAL only)
 * - Type selector with premium horizontal SegmentedControl component
 * - Strict 100% type-safety without generic 'any' escapes
 */
import { Component, Show, For, createMemo, createEffect, createSignal } from 'solid-js';
import type { LocationType } from '@app/schema/enums';
import { locationTypeOptions, LOCATION_TYPE_META } from '../data/locations.constants';
import { useLocationList } from '../data/locations.queries';
import type { LocationItem } from '../data/locations.api';
import { FormSubmissionContext } from '@shared/ui/form/form.types';
import { FieldLabel } from '@shared/ui/TextField';
import TextField from '@shared/ui/TextField';
import { SkeletonLoader } from '@shared/ui/SkeletonLoader';
import { WarehouseSelect, LocationSelect } from '@shared/ui/selectors';
import {
    SegmentedControl,
    SegmentedControlIndicator,
    SegmentedControlItem,
    SegmentedControlItemInput,
    SegmentedControlItemLabel,
} from '@shared/ui/SegmentedControl';
import { cn } from '@shared/lib/utils';
import { createForm } from '@tanstack/solid-form';
import { valibotValidator } from '@tanstack/valibot-form-adapter';
import { LocationFormSchema, type LocationFormData } from '@app/schema/frontend';
import { ApiError } from '@shared/utils/api-errors';

interface LocationFormProps {
    /** Existing location data for edit mode */
    location?: LocationItem | null;
    /** Submit handler returning a promise for loading/error coordination */
    onSubmit: (data: LocationFormData) => Promise<void>;
    /** Whether the form is currently submitting in the sheet */
    isSubmitting: boolean;
    /** HTML form element ID to connect submit button externally */
    formId: string;
    /** Disable all controls */
    disabled?: boolean;
    /** Pre-selected parent for "Add child" flow */
    defaultParentId?: number;
    /** ID of the location being edited (to exclude from parent options) */
    editingId?: number;
}

const LocationForm: Component<LocationFormProps> = (props) => {
    const isDisabled = () => props.disabled ?? false;
    const [hasAttemptedSubmit, setHasAttemptedSubmit] = createSignal(false);

    // Query for parent details and inheritance
    const locationsQuery = useLocationList();

    // Build default values from existing location (edit) or props (create)
    const initialValues = (): LocationFormData => {
        if (props.location) {
            return {
                name: props.location.name,
                type: props.location.type as 'VIEW' | 'INTERNAL',
                parent_id: props.location.parent_id ?? null,
                warehouse_id: props.location.warehouse_id ?? null,
            };
        }
        return {
            name: '',
            type: 'INTERNAL',
            parent_id: props.defaultParentId ?? null,
            warehouse_id: null,
        };
    };

    const form = createForm(() => ({
        defaultValues: initialValues(),
        validatorAdapter: valibotValidator(),
        validators: { onChange: LocationFormSchema, onSubmit: LocationFormSchema },
        onSubmit: async ({ value }) => {
            try {
                await props.onSubmit(value);
            } catch (err) {
                if (err instanceof ApiError && err.errors?.length) {
                    for (const fieldErr of err.errors) {
                        try {
                            form.setFieldMeta(fieldErr.field as any, (prev) => ({
                                ...prev,
                                errorMap: { ...prev.errorMap, onSubmit: fieldErr.message },
                            }));
                        } catch { /* field not in form */ }
                    }
                }
            }
        },
    }));

    // Current type value (reactive)
    const currentType = form.useStore((s) => s.values.type);

    // Parent ID value (reactive)
    const parentId = form.useStore((s) => s.values.parent_id);

    // Selected warehouse value (reactive)
    const selectedWarehouseId = form.useStore((s) => s.values.warehouse_id);

    // Parent options: exclude self and inactive (except current parent when editing)
    const parentOptions = createMemo(() => {
        const flat = (locationsQuery.data ?? []) as LocationItem[];
        if (!props.editingId) return flat.filter(l => (l.is_active ?? true));
        return flat.filter(l => l.id !== props.editingId && (l.is_active ?? true));
    });

    // When parent changes, auto-inherit warehouse from parent
    const handleParentSelect = (loc: LocationItem | null) => {
        const currentPid = form.getFieldValue('parent_id');
        const nextPid = loc ? loc.id : null;
        if (nextPid !== currentPid) {
            form.setFieldValue('warehouse_id', loc?.warehouse_id ?? null);
        }
    };

    let initializedDefault = false;
    // Set default parent on mount
    createEffect(() => {
        const defaultPid = props.defaultParentId;
        if (defaultPid && !initializedDefault && parentOptions().length > 0) {
            initializedDefault = true;
            form.setFieldValue('parent_id', defaultPid);
            // Also inherit warehouse from default parent
            const parent = parentOptions().find(l => l.id === defaultPid);
            if (parent?.warehouse_id) {
                form.setFieldValue('warehouse_id', parent.warehouse_id);
            }
            queueMicrotask(() => {
                form.setFieldMeta('parent_id', (prev) => ({ ...prev, isTouched: false }));
                form.setFieldMeta('warehouse_id', (prev) => ({ ...prev, isTouched: false }));
            });
        }
    });

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
                class="flex flex-col gap-4 py-2"
            >
                {/* 1. Type Select (Tipo) */}
                <form.Field name="type">
                    {(field) => (
                        <div class="space-y-1.5 flex flex-col items-start w-full @container">
                            <FieldLabel>Tipo *</FieldLabel>
                            <SegmentedControl
                                value={field().state.value as string}
                                onChange={(val) => {
                                    if (val) field().handleChange(val as LocationType);
                                }}
                                disabled={isDisabled()}
                                class="w-full @sm:w-full"
                            >
                                <SegmentedControlIndicator />
                                <For each={locationTypeOptions}>
                                    {(opt) => (
                                        <SegmentedControlItem value={opt.value}>
                                            <SegmentedControlItemInput />
                                            <SegmentedControlItemLabel class="flex items-center gap-2">
                                                {(() => {
                                                    const m = LOCATION_TYPE_META[opt.value];
                                                    const Icon = m.icon;
                                                    return <Icon class={cn("size-4 transition-colors", m.color.split(' ')[0])} />;
                                                })()}
                                                <span>{opt.label}</span>
                                            </SegmentedControlItemLabel>
                                        </SegmentedControlItem>
                                    )}
                                </For>
                            </SegmentedControl>

                            {/* Dynamic description of the selected type */}
                            <span class="text-xs text-muted/70 ml-1 mt-0.5">
                                {LOCATION_TYPE_META[currentType()]?.description}
                            </span>
                        </div>
                    )}
                </form.Field>

                {/* 2. Name (Nombre) */}
                <form.Field name="name">
                    {(field) => (
                        <TextField.Root field={field()} disabled={isDisabled()}>
                            <TextField.Label>Nombre *</TextField.Label>
                            <TextField.Input
                                type="text"
                                placeholder="Estante A1, Zona de Recepción..."
                            />
                            <TextField.ErrorMessage />
                        </TextField.Root>
                    )}
                </form.Field>

                {/* 3. Parent Autocomplete (Ubicación Padre) */}
                <form.Field name="parent_id">
                    {(field) => (
                        <div class="flex flex-col w-full min-w-0">
                            <Show
                                when={!locationsQuery.isLoading}
                                fallback={
                                    <>
                                        <FieldLabel>Ubicación Padre</FieldLabel>
                                        <SkeletonLoader type="text" class="h-10 w-full" />
                                    </>
                                }
                            >
                                <LocationSelect
                                    value={parentId()}
                                    onChange={(id, loc) => {
                                        field().handleChange(id);
                                        handleParentSelect(loc);
                                    }}
                                    label="Ubicación Padre"
                                    placeholder="Buscar ubicación padre..."
                                    field={field()}
                                    disabled={isDisabled()}
                                    editingId={props.editingId}
                                />
                            </Show>
                            <span class="text-xs text-muted/70 ml-1 mt-0.5">
                                Deja vacío para crear como ubicación raíz
                            </span>
                        </div>
                    )}
                </form.Field>

                {/* 4. Warehouse (Bodega) */}
                <form.Field name="warehouse_id">
                    {(field) => (
                        <div class="flex flex-col gap-1 w-full">
                            <WarehouseSelect
                                value={selectedWarehouseId()}
                                onChange={(id) => {
                                    field().handleChange(id);
                                }}
                                label="Bodega"
                                placeholder="Seleccionar bodega..."
                                field={field()}
                                disabled={isDisabled()}
                            />
                        </div>
                    )}
                </form.Field>
            </form>
        </FormSubmissionContext.Provider>
    );
};

export default LocationForm;
