/**
 * SupplierFilterSheet — Mobile bottom-up slide-in panel for supplier filters.
 *
 * Renders all faceted filter groups (Tipo, Identificación, Estado, Razón Social)
 * reusing the same `DataTableColumnFilter` component used in the desktop table headers.
 */
import { Component, createSignal, For, Show } from 'solid-js';
import Sheet from '@shared/ui/Sheet';
import Checkbox from '@shared/ui/Checkbox';
import { SearchIcon, FilterIcon } from '@shared/ui/icons';
import { cn } from '@shared/lib/utils';
import type { FilterOption } from '@shared/ui/DataTable/DataTableColumnFilter';

// ============================================================================
// Inline filter group (used inside the Sheet — not a popover)
// ============================================================================

interface FilterGroupProps {
    title: string;
    options: FilterOption[];
    selected: string[];
    onSelectionChange: (v: string[]) => void;
    isLoading?: boolean;
}

const FilterGroup: Component<FilterGroupProps> = (props) => {
    const [search, setSearch] = createSignal('');

    const filtered = () => {
        const q = search().toLowerCase();
        if (!q) return props.options;
        return props.options.filter((o) => o.label.toLowerCase().includes(q));
    };

    const isSelected = (value: string) => props.selected.includes(value);

    const toggle = (value: string) => {
        const current = new Set(props.selected);
        if (current.has(value)) current.delete(value);
        else current.add(value);
        props.onSelectionChange([...current]);
    };

    const clearAll = () => props.onSelectionChange([]);

    const activeCount = () => props.selected.length;

    return (
        <div class="mb-4">
            {/* Group header */}
            <div class="flex items-center justify-between mb-2">
                <span class="text-xs font-semibold text-muted uppercase tracking-wider">
                    {props.title}
                    <Show when={activeCount() > 0}>
                        <span class="ml-1.5 px-1.5 py-0.5 rounded-full bg-primary/15 text-primary text-[10px] font-bold">
                            {activeCount()}
                        </span>
                    </Show>
                </span>
                <Show when={activeCount() > 0}>
                    <button
                        type="button"
                        onClick={clearAll}
                        class="text-xs text-muted hover:text-primary transition-colors cursor-pointer"
                    >
                        Limpiar
                    </button>
                </Show>
            </div>

            {/* Options — show search only when more than 4 */}
            <Show when={props.options.length > 4}>
                <div class="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-surface-2 border border-border mb-2">
                    <SearchIcon class="size-3.5 text-muted shrink-0" />
                    <input
                        type="text"
                        placeholder={`Buscar ${props.title.toLowerCase()}...`}
                        value={search()}
                        onInput={(e) => setSearch(e.currentTarget.value)}
                        class="flex-1 bg-transparent text-sm text-text placeholder:text-muted outline-none"
                    />
                </div>
            </Show>

            <Show when={props.isLoading}>
                <div class="space-y-2">
                    <For each={[1, 2, 3]}>
                        {() => <div class="h-9 rounded-xl bg-surface-2 animate-pulse" />}
                    </For>
                </div>
            </Show>

            <Show when={!props.isLoading}>
                <div class="space-y-0.5">
                    <For each={filtered()}>
                        {(option) => (
                            <label
                                class={cn(
                                    'flex items-center gap-3 px-3 py-2 rounded-xl cursor-pointer transition-colors',
                                    isSelected(option.value)
                                        ? 'bg-primary/10 text-primary'
                                        : 'hover:bg-surface-2 text-text',
                                )}
                            >
                                <Checkbox
                                    checked={isSelected(option.value)}
                                    onChange={() => toggle(option.value)}
                                />
                                <span class="flex-1 text-sm">{option.label}</span>
                                <span class={cn(
                                    'text-xs tabular-nums font-medium px-2 py-0.5 rounded-full',
                                    isSelected(option.value)
                                        ? 'bg-primary/20 text-primary'
                                        : 'bg-surface-2 text-muted',
                                )}>
                                    {option.count}
                                </span>
                            </label>
                        )}
                    </For>
                    <Show when={filtered().length === 0 && search()}>
                        <p class="text-sm text-muted text-center py-4">Sin coincidencias</p>
                    </Show>
                </div>
            </Show>
        </div>
    );
};

// ============================================================================
// SupplierFilterSheet
// ============================================================================

export interface FilterConfig {
    options: () => FilterOption[];
    selected: () => string[];
    onChange: (v: string[]) => void;
    isLoading: () => boolean;
}

export interface SupplierFilterSheetProps {
    isOpen: boolean;
    onClose: () => void;
    filters: {
        personType: FilterConfig;
        taxIdType: FilterConfig;
        isActive: FilterConfig;
        businessName: FilterConfig;
    };
}

const GROUPS = [
    { key: 'isActive',    label: 'Estado' },
    { key: 'personType',  label: 'Tipo de persona' },
    { key: 'taxIdType',   label: 'Tipo de identificación' },
    { key: 'businessName',label: 'Razón Social' },
] as const;

export const SupplierFilterSheet: Component<SupplierFilterSheetProps> = (props) => {
    const totalActive = () =>
        GROUPS.reduce((acc, g) => acc + props.filters[g.key].selected().length, 0);

    const clearAll = () => {
        GROUPS.forEach((g) => props.filters[g.key].onChange([]));
    };

    return (
        <Sheet
            isOpen={props.isOpen}
            onClose={props.onClose}
            title="Filtros"
            description={totalActive() > 0 ? `${totalActive()} filtro(s) activo(s)` : 'Filtra los proveedores por categoría'}
            side="right"
            size="sm"
        >
            {/* Clear all */}
            <Show when={totalActive() > 0}>
                <button
                    type="button"
                    onClick={clearAll}
                    class="flex items-center gap-2 text-sm text-red-400 hover:text-red-300 mb-5 cursor-pointer transition-colors"
                >
                    <FilterIcon class="size-3.5" />
                    Limpiar todos los filtros
                </button>
            </Show>

            {/* Filter groups */}
            <For each={GROUPS}>
                {(group) => (
                    <FilterGroup
                        title={group.label}
                        options={props.filters[group.key].options()}
                        selected={props.filters[group.key].selected()}
                        onSelectionChange={props.filters[group.key].onChange}
                        isLoading={props.filters[group.key].isLoading()}
                    />
                )}
            </For>
        </Sheet>
    );
};
