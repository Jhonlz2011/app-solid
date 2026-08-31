/**
 * EntitySelect — Standardized, Multi-Role Entity Selector Component.
 *
 * Features:
 * - Anti-CLS (Zero Layout Shift): Selected card mask matches input dimensions.
 * - Multi-Role Filtering: Supports isEmployee, isClient, isSupplier, isCarrier, or type.
 * - TanStack Form & Controlled support with full E2E type safety.
 * - Standard FieldLabel integration with tooltip support.
 */
import { JSX, Show, createMemo, createSignal, createEffect, onCleanup, useContext } from 'solid-js';
import { useEntityPicker } from '@modules/entities/data/entities.queries';
import type { EntityPickerType } from '@app/schema/dto';
import type { EntityType } from '@app/schema/enums';
import type { FieldLike } from '@shared/ui/form/form.types';
import { FormSubmissionContext, hasFieldError, getFieldError } from '@shared/ui/form/form.types';
import { FieldLabel } from '@form/TextField';
import { Autocomplete } from '@form/Autocomplete';
import { CloseIcon } from '@icons/CloseIcon';
import { UserIcon } from '@icons/UserIcon';
import Button from '@form/Button';

export interface EntitySelectProps<TValue extends string | null | undefined = string | null | undefined> {
    value?: TValue;
    onChange?: (id: string | null, entity: EntityPickerType | null) => void;
    label?: string;
    tooltip?: string | JSX.Element;
    placeholder?: string;
    field?: FieldLike<TValue>;
    disabled?: boolean;
    type?: EntityType;
    isClient?: boolean;
    isSupplier?: boolean;
    isEmployee?: boolean;
    isCarrier?: boolean;
    isActive?: boolean;
    excludeEntityId?: string;
    /** Initial entity data for instant zero-CLS hydration when editing */
    initialEntity?: { id: string; businessName: string; taxId: string } | null;
}

export function EntitySelect<TValue extends string | null | undefined = string | null | undefined>(
    props: EntitySelectProps<TValue>
) {
    const isFormSubmitted = useContext(FormSubmissionContext);
    const [localQuery, setLocalQuery] = createSignal('');
    const [debouncedQuery, setDebouncedQuery] = createSignal('');
    const [selectedEntityCache, setSelectedEntityCache] = createSignal<{
        id: string;
        businessName: string;
        taxId: string;
    } | null>(props.initialEntity ?? null);

    createEffect(() => {
        if (props.initialEntity) {
            setSelectedEntityCache(props.initialEntity);
        }
    });

    let debounceTimer: ReturnType<typeof setTimeout>;
    onCleanup(() => clearTimeout(debounceTimer));

    const entitiesQuery = useEntityPicker(() => ({
        search: debouncedQuery() || undefined,
        limit: 30,
        type: props.type,
        isClient: props.isClient,
        isSupplier: props.isSupplier,
        isEmployee: props.isEmployee,
        isCarrier: props.isCarrier,
        isActive: props.isActive ?? true,
    }));

    const entityList = createMemo(() => {
        const raw = entitiesQuery.data || [];
        if (props.excludeEntityId) {
            return raw.filter((e) => e.id !== props.excludeEntityId);
        }
        return raw;
    });

    const activeValue = () => props.field ? (props.field.state.value as string | null | undefined) : props.value;

    // Hydrate or track selected entity details
    const selectedEntity = createMemo(() => {
        const val = activeValue();
        if (!val) return null;

        // 1. Check current fetched list
        const fromList = entityList().find((e) => e.id === val);
        if (fromList) return fromList;

        // 2. Check cached selected entity (from initialEntity or recent selection)
        const cached = selectedEntityCache();
        if (cached && cached.id === val) return cached;

        return null;
    });

    // Sync search text when selection changes
    createEffect(() => {
        const entity = selectedEntity();
        if (entity) {
            setLocalQuery(entity.businessName);
        } else if (!activeValue()) {
            setLocalQuery('');
        }
    });

    const handleInputChange = (val: string) => {
        setLocalQuery(val);
        if (val === '') {
            clearTimeout(debounceTimer);
            setDebouncedQuery('');
            if (activeValue()) {
                handleSelect(null);
            }
        }
    };

    const handleSearchAction = (val: string) => {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
            setDebouncedQuery(val.trim());
        }, 250);
    };

    const handleSelect = (entity: EntityPickerType | null) => {
        if (entity) {
            setSelectedEntityCache({
                id: entity.id,
                businessName: entity.businessName,
                taxId: entity.taxId,
            });
            setLocalQuery(entity.businessName);
            props.onChange?.(entity.id, entity);
            props.field?.handleChange(entity.id as unknown as TValue);
        } else {
            setSelectedEntityCache(null);
            setLocalQuery('');
            setDebouncedQuery('');
            props.onChange?.(null, null);
            props.field?.handleChange(null as unknown as TValue);
        }
    };

    const handleUnlink = () => {
        handleSelect(null);
    };

    return (
        <div class="space-y-1 w-full">
            <Show when={props.label !== undefined}>
                <FieldLabel tooltip={props.tooltip}>
                    {props.label}
                </FieldLabel>
            </Show>

            <Show
                when={selectedEntity()}
                keyed
                fallback={
                    <Autocomplete.Root field={props.field}>
                        <Autocomplete.Input<EntityPickerType>
                            value={localQuery()}
                            onInputChange={handleInputChange}
                            onSearchAction={handleSearchAction}
                            options={entityList()}
                            optionValue={(e) => e.id}
                            optionLabel={(e) => e.businessName}
                            optionDescription={(e) => e.taxId}
                            placeholder={props.placeholder ?? 'Buscar por nombre o identificación (RUC/Cédula)...'}
                            isLoading={entitiesQuery.isFetching}
                            disabled={props.disabled}
                            minLength={0}
                            onSelect={handleSelect}
                        />
                        <Autocomplete.ErrorMessage />
                    </Autocomplete.Root>
                }
            >
                {(entity) => (
                    <div class="flex items-center gap-3 px-3 py-1.5 rounded-xl bg-primary/5 border border-primary/20 hover:border-primary/35 transition-all duration-200 shadow-sm min-h-10">
                        {/* Avatar initials */}
                        <div class="size-7 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0 font-bold text-xs">
                            {entity.businessName.charAt(0).toUpperCase() || <UserIcon class="size-3.5" />}
                        </div>

                        {/* Info */}
                        <div class="flex-1 min-w-0">
                            <p class="text-sm font-semibold text-text truncate leading-tight">
                                {entity.businessName}
                            </p>
                            <p class="text-xs text-muted font-mono leading-none mt-0.5">
                                {entity.taxId}
                            </p>
                        </div>

                        {/* Unlink / Clear Button */}
                        <Button
                            variant="ghost"
                            size="sm"
                            type="button"
                            onClick={handleUnlink}
                            disabled={props.disabled}
                            class="text-muted hover:text-danger hover:bg-danger/10 size-7 p-0 rounded-lg shrink-0 transition-colors"
                            title="Desvincular entidad"
                        >
                            <CloseIcon class="size-3.5" />
                        </Button>
                    </div>
                )}
            </Show>

            <Show when={props.field && hasFieldError(props.field, isFormSubmitted())}>
                <span class="text-xs font-medium text-danger ml-1 block animate-fade-in">
                    {getFieldError(props.field!)}
                </span>
            </Show>
        </div>
    );
}

export default EntitySelect;
