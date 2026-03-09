/**
 * DataTableColumnFilter - Faceted filter popover for table column headers
 *
 * Features:
 * - Search input to filter options client-side
 * - Native `title` on truncated labels (zero-cost tooltip, no flash)
 * - Select All / Deselect All quick actions
 * - Selectable options with counts (checkbox + label + count badge)
 * - TanStack Virtual for large option lists (e.g. business_name)
 * - Active filter indicator on the trigger icon
 * - "Limpiar filtros" button to reset
 */
import { Component, For, Show, JSX, createSignal, createMemo, createEffect } from 'solid-js';
import { createVirtualizer } from '@tanstack/solid-virtual';
import { Popover } from '../Popover';
import Checkbox from '../Checkbox';
import { FilterIcon, SearchIcon } from '../icons';
import { cn } from '@shared/lib/utils';

// =============================================================================
// Types
// =============================================================================

export interface FilterOption {
    value: string;
    label: string;
    count: number;
    icon?: JSX.Element;
}

export interface DataTableColumnFilterProps {
    /** Available options to display */
    options: FilterOption[];
    /** Currently selected values */
    selected: string[];
    /** Called when selection changes */
    onSelectionChange: (selected: string[]) => void;
    /** Column title (shown in search placeholder) */
    title: string;
    /** Loading state */
    isLoading?: boolean;
    /** Whether to enable virtualization (recommended for >50 items) */
    enableVirtualization?: boolean;
}

// =============================================================================
// Component
// =============================================================================

export const DataTableColumnFilter: Component<DataTableColumnFilterProps> = (props) => {
    const [filterSearch, setFilterSearch] = createSignal('');
    const [open, setOpen] = createSignal(false);
    let scrollContainerRef: HTMLDivElement | undefined;

    const activeCount = () => props.selected.length;
    const hasActiveFilters = () => activeCount() > 0;

    // Client-side filtered options
    const filteredOptions = createMemo(() => {
        const search = filterSearch().toLowerCase();
        if (!search) return props.options;
        return props.options.filter(opt => opt.label.toLowerCase().includes(search));
    });

    // Auto-prune stale selections: if all selected values disappeared from options
    // (e.g. last "Inactivo" record was restored), clear the filter automatically.
    createEffect(() => {
        const selected = props.selected;
        if (selected.length === 0) return;

        const availableValues = new Set(props.options.map(o => o.value));
        const validSelections = selected.filter(v => availableValues.has(v));

        // Only auto-clear if ALL selections became stale (the filtered category vanished entirely)
        if (validSelections.length < selected.length) {
            props.onSelectionChange(validSelections);
        }
    });

    const shouldVirtualize = () =>
        props.enableVirtualization ?? filteredOptions().length > 50;

    // All visible filtered options are selected
    const allFilteredSelected = createMemo(() => {
        if (filteredOptions().length === 0) return false;
        const sel = new Set(props.selected);
        return filteredOptions().every(o => sel.has(o.value));
    });

    const someFilteredSelected = createMemo(() => {
        const sel = new Set(props.selected);
        return filteredOptions().some(o => sel.has(o.value));
    });

    const toggleOption = (value: string) => {
        const current = new Set(props.selected);
        if (current.has(value)) current.delete(value);
        else current.add(value);
        props.onSelectionChange(Array.from(current));
    };

    // Select all currently-visible (filtered) options
    const selectAll = () => {
        const merged = Array.from(new Set([...props.selected, ...filteredOptions().map(o => o.value)]));
        props.onSelectionChange(merged);
    };

    // Deselect all currently-visible (filtered) options
    const deselectAll = () => {
        const filteredValues = new Set(filteredOptions().map(o => o.value));
        props.onSelectionChange(props.selected.filter(v => !filteredValues.has(v)));
    };

    const clearFilters = () => {
        props.onSelectionChange([]);
        setFilterSearch('');
    };

    const handleOpenChange = (isOpen: boolean) => {
        setOpen(isOpen);
        if (!isOpen) setFilterSearch('');
    };

    return (
        <Popover open={open()} onOpenChange={handleOpenChange} placement="bottom-start" gutter={4}>
            <Popover.Trigger
                class={cn(
                    'p-1 rounded-md transition-colors duration-150 cursor-pointer',
                    hasActiveFilters()
                        ? 'text-primary bg-primary/10 hover:bg-primary/20'
                        : 'text-muted hover:text-text hover:bg-card-alt',
                )}
                title={hasActiveFilters() ? `${activeCount()} filtro(s) activo(s)` : `Filtrar por ${props.title}`}
            >
                <FilterIcon class="size-3.5" />
                <Show when={hasActiveFilters()}>
                    <span class="sr-only">{activeCount()} filtro(s) activo(s)</span>
                </Show>
            </Popover.Trigger>

            <Popover.Content class="w-[260px] p-0">
                {/* Search */}
                <div class="flex items-center gap-2 px-3 py-2 border-b border-border">
                    <SearchIcon class="size-4 text-muted shrink-0" />
                    <input
                        type="text"
                        placeholder={props.title}
                        value={filterSearch()}
                        onInput={(e) => setFilterSearch(e.currentTarget.value)}
                        class="flex-1 bg-transparent text-sm text-text placeholder:text-muted outline-none"
                        autofocus
                    />
                </div>

                {/* Select All / Deselect quick row */}
                <Show when={filteredOptions().length > 0 && !props.isLoading}>
                    <div class="flex items-center justify-between px-3 py-1.5 border-b border-border/50">
                        <span class="text-xs text-muted tabular-nums">
                            {filteredOptions().length} opción{filteredOptions().length !== 1 ? 'es' : ''}
                        </span>
                        <div class="flex items-center gap-2 h-4">
                            <Show
                                when={allFilteredSelected()}
                                fallback={
                                    <button
                                        type="button"
                                        onClick={selectAll}
                                        class="text-xs text-primary hover:underline cursor-pointer transition-colors"
                                    >
                                        Seleccionar todo
                                    </button>
                                }
                            >
                                <button
                                    type="button"
                                    onClick={deselectAll}
                                    class="text-xs text-muted hover:text-text cursor-pointer transition-colors"
                                >
                                    Deseleccionar todo
                                </button>
                            </Show>
                            <Show when={!allFilteredSelected() && someFilteredSelected()}>
                                <span class="text-border-strong">·</span>
                                <button
                                    type="button"
                                    onClick={deselectAll}
                                    class="text-xs text-muted hover:text-text cursor-pointer transition-colors"
                                >
                                    Limpiar
                                </button>
                            </Show>
                        </div>
                    </div>
                </Show>

                {/* Options List
                    will-change: contents prevents layout-recalculation flash when a row
                    changes its background-color on selection. */}
                <div
                    ref={scrollContainerRef}
                    class="max-h-[240px] overflow-y-auto"
                    style={{ "will-change": "contents" }}
                >
                    <Show
                        when={!props.isLoading}
                        fallback={<div class="py-6 text-center text-sm text-muted">Cargando opciones...</div>}
                    >
                        <Show
                            when={filteredOptions().length > 0}
                            fallback={<div class="py-6 text-center text-sm text-muted">Sin resultados</div>}
                        >
                            <Show
                                when={shouldVirtualize()}
                                fallback={
                                    <FilterOptionsList
                                        options={filteredOptions()}
                                        selected={props.selected}
                                        onToggle={toggleOption}
                                    />
                                }
                            >
                                <VirtualizedOptionsList
                                    options={filteredOptions()}
                                    selected={props.selected}
                                    onToggle={toggleOption}
                                    scrollContainerRef={scrollContainerRef}
                                />
                            </Show>
                        </Show>
                    </Show>
                </div>

            </Popover.Content>
        </Popover>
    );
};

// =============================================================================
// Non-Virtualized Options List
// =============================================================================

interface FilterOptionsListProps {
    options: FilterOption[];
    selected: string[];
    onToggle: (value: string) => void;
}

const FilterOptionsList: Component<FilterOptionsListProps> = (props) => {
    const selectedSet = createMemo(() => new Set(props.selected));

    return (
        <div class="py-1">
            <For each={props.options}>
                {(option) => (
                    <FilterOptionItem
                        option={option}
                        isSelected={selectedSet().has(option.value)}
                        onToggle={props.onToggle}
                    />
                )}
            </For>
        </div>
    );
};

// =============================================================================
// Virtualized Options List (TanStack Virtual)
// =============================================================================

interface VirtualizedOptionsListProps {
    options: FilterOption[];
    selected: string[];
    onToggle: (value: string) => void;
    scrollContainerRef?: HTMLDivElement;
}

const VirtualizedOptionsList: Component<VirtualizedOptionsListProps> = (props) => {
    const selectedSet = createMemo(() => new Set(props.selected));

    const virtualizer = createVirtualizer({
        get count() { return props.options.length; },
        getScrollElement: () => props.scrollContainerRef ?? null,
        estimateSize: () => 36,
        overscan: 5,
    });

    return (
        <div style={{ height: `${virtualizer.getTotalSize()}px`, width: '100%', position: 'relative' }}>
            <For each={virtualizer.getVirtualItems()}>
                {(virtualRow) => {
                    const option = () => props.options[virtualRow.index];
                    return (
                        <div
                            style={{
                                position: 'absolute',
                                top: 0,
                                left: 0,
                                width: '100%',
                                height: `${virtualRow.size}px`,
                                transform: `translateY(${virtualRow.start}px)`,
                            }}
                        >
                            <FilterOptionItem
                                option={option()}
                                isSelected={selectedSet().has(option().value)}
                                onToggle={props.onToggle}
                            />
                        </div>
                    );
                }}
            </For>
        </div>
    );
};

// =============================================================================
// Single Option Item
// =============================================================================

interface FilterOptionItemProps {
    option: FilterOption;
    isSelected: boolean;
    onToggle: (value: string) => void;
}

const FilterOptionItem: Component<FilterOptionItemProps> = (props) => {
    return (
        <button
            type="button"
            // Native title: shows full text on hover when label is truncated.
            // Avoids extra Tooltip component mount cost and prevents the repaint flash
            // caused by portal-based tooltips during rapid state changes.
            title={props.option.label}
            class={cn(
                'w-full flex items-center gap-2 px-3 py-1.5 text-sm cursor-pointer',
                'transition-colors duration-100',
                props.isSelected
                    ? 'bg-primary/8 text-text'
                    : 'text-text hover:bg-card-alt',
            )}
            onClick={() => props.onToggle(props.option.value)}
        >
            <Checkbox
                checked={props.isSelected}
                onChange={() => props.onToggle(props.option.value)}
                class="pointer-events-none shrink-0"
            />
            <Show when={props.option.icon}>
                <span class="size-4 text-muted shrink-0">{props.option.icon}</span>
            </Show>
            {/* min-w-0 is required alongside truncate for flex children to actually shrink */}
            <span class="flex-1 min-w-0 text-left truncate">{props.option.label}</span>
            <span class="text-xs text-muted tabular-nums shrink-0 ml-1">{props.option.count}</span>
        </button>
    );
};

export default DataTableColumnFilter;
