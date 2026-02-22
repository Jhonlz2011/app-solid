/**
 * DataTableColumnFilter - Faceted filter popover for table column headers
 *
 * Features:
 * - Search input to filter options client-side
 * - Selectable options with counts (checkbox + label + count badge)
 * - TanStack Virtual for large option lists (e.g. business_name)
 * - Active filter indicator on the trigger icon
 * - "Limpiar filtros" button to reset
 */
import { Component, For, Show, JSX, createSignal, createMemo, onMount, onCleanup } from 'solid-js';
import { createVirtualizer } from '@tanstack/solid-virtual';
import { Popover } from './Popover';
import Checkbox from './Checkbox';
import { FilterIcon, SearchIcon } from './icons';
import { cn } from '../lib/utils';

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

    // Active filter count
    const activeCount = () => props.selected.length;
    const hasActiveFilters = () => activeCount() > 0;

    // Client-side filtered options
    const filteredOptions = createMemo(() => {
        const search = filterSearch().toLowerCase();
        if (!search) return props.options;
        return props.options.filter(opt =>
            opt.label.toLowerCase().includes(search)
        );
    });

    // Should virtualize (auto or forced)
    const shouldVirtualize = () =>
        props.enableVirtualization ?? filteredOptions().length > 50;

    // Toggle a single option
    const toggleOption = (value: string) => {
        const current = new Set(props.selected);
        if (current.has(value)) {
            current.delete(value);
        } else {
            current.add(value);
        }
        props.onSelectionChange(Array.from(current));
    };

    // Clear all filters
    const clearFilters = () => {
        props.onSelectionChange([]);
        setFilterSearch('');
    };

    // Reset search when popover closes
    const handleOpenChange = (isOpen: boolean) => {
        setOpen(isOpen);
        if (!isOpen) {
            setFilterSearch('');
        }
    };

    return (
        <Popover
            open={open()}
            onOpenChange={handleOpenChange}
            placement="bottom-start"
            gutter={4}
        >
            <Popover.Trigger
                class={cn(
                    'p-1 rounded-md transition-colors duration-150 cursor-pointer',
                    hasActiveFilters()
                        ? 'text-primary bg-primary/10 hover:bg-primary/20'
                        : 'text-muted hover:text-text hover:bg-card-alt',
                )}
                title={hasActiveFilters()
                    ? `${activeCount()} filtro(s) activo(s)`
                    : `Filtrar por ${props.title}`
                }
            >
                <FilterIcon class="size-3.5" />
                <Show when={hasActiveFilters()}>
                    <span class="sr-only">{activeCount()} filtro(s) activo(s)</span>
                </Show>
            </Popover.Trigger>

            <Popover.Content class="w-[260px] p-0">
                {/* Search Input */}
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

                {/* Options List */}
                <div
                    ref={scrollContainerRef}
                    class="max-h-[280px] overflow-y-auto"
                >
                    <Show
                        when={!props.isLoading}
                        fallback={
                            <div class="py-6 text-center text-sm text-muted">
                                Cargando opciones...
                            </div>
                        }
                    >
                        <Show
                            when={filteredOptions().length > 0}
                            fallback={
                                <div class="py-6 text-center text-sm text-muted">
                                    Sin resultados
                                </div>
                            }
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

                {/* Footer - Clear button */}
                <Show when={hasActiveFilters()}>
                    <div class="border-t border-border px-3 py-2">
                        <button
                            onClick={clearFilters}
                            class="w-full text-xs text-muted hover:text-primary transition-colors py-1 text-center cursor-pointer"
                        >
                            Limpiar filtros
                        </button>
                    </div>
                </Show>
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
        <div
            style={{
                height: `${virtualizer.getTotalSize()}px`,
                width: '100%',
                position: 'relative',
            }}
        >
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
                class="pointer-events-none"
            />
            <Show when={props.option.icon}>
                <span class="size-4 text-muted shrink-0">{props.option.icon}</span>
            </Show>
            <span class="flex-1 text-left truncate">{props.option.label}</span>
            <span class="text-xs text-muted tabular-nums shrink-0">{props.option.count}</span>
        </button>
    );
};

export default DataTableColumnFilter;
