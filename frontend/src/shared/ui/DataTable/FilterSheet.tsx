/**
 * FilterSheet — Generic mobile filter panel with faceted filter groups.
 *
 * Renders a Sheet with multiple FilterGroup sections, each with:
 * - Searchable option list (auto-hides search when ≤ 4 options)
 * - Checkbox selection with counts
 * - Active selection badges and per-group clear
 * - Global "clear all filters" button
 *
 * Extracted from SupplierFilterSheet — 100% module-agnostic.
 */
import { Component, createSignal, For, Show } from 'solid-js';
import Sheet from '@shared/ui/Sheet';
import Checkbox from '@shared/ui/Checkbox';
import { SearchIcon, FilterIcon } from '@shared/ui/icons';
import { cn } from '@shared/lib/utils';
import type { FilterOption } from '@shared/ui/DataTable/DataTableColumnFilter';
import Button from '@shared/ui/Button';

// ============================================================================
// FilterGroup — Single section inside the sheet
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
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={clearAll}
                        class="h-auto p-0 px-2 text-xs text-muted hover:text-primary bg-transparent text-primary hover:bg-primary/5"
                    >
                        Limpiar
                    </Button>
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
// FilterSheet — Generic Sheet component
// ============================================================================

export interface FilterConfig {
    options: () => FilterOption[];
    selected: () => string[];
    onChange: (v: string[]) => void;
    isLoading: () => boolean;
}

export interface FilterGroupDef {
    key: string;
    label: string;
}

export interface FilterSheetProps {
    isOpen: boolean;
    onClose: () => void;
    /** Filter configurations keyed by group key */
    filters: Record<string, FilterConfig>;
    /** Ordered list of filter groups to render */
    groups: FilterGroupDef[];
    /** Optional title override (defaults to "Filtros") */
    title?: string;
    /** Optional entity name for descriptions */
    entityName?: string;
}

export const FilterSheet: Component<FilterSheetProps> = (props) => {
    const groups = () => props.groups;

    const totalActive = () =>
        groups().reduce((acc, g) => acc + (props.filters[g.key]?.selected().length ?? 0), 0);

    const clearAll = () => {
        groups().forEach((g) => props.filters[g.key]?.onChange([]));
    };

    return (
        <Sheet
            isOpen={props.isOpen}
            onClose={props.onClose}
            title={props.title ?? 'Filtros'}
            description={
                totalActive() > 0
                    ? `${totalActive()} filtro(s) activo(s)`
                    : `Filtra ${props.entityName ? `los ${props.entityName}` : 'los registros'} por categoría`
            }
            side="right"
            size="sm"
        >
            {/* Clear all */}
            <Show when={totalActive() > 0}>
                <Button
                    variant="ghost"
                    onClick={clearAll}
                    class="h-auto p-2 justify-start w-auto flex items-center gap-2 text-sm text-danger hover:text-danger hover:bg-danger/10 mb-5 bg-transparent border-transparent"
                >
                    <FilterIcon class="size-3.5" />
                    Limpiar todos los filtros
                </Button>
            </Show>

            {/* Filter groups */}
            <For each={groups()}>
                {(group) => {
                    const config = () => props.filters[group.key];
                    return (
                        <Show when={config()}>
                            <FilterGroup
                                title={group.label}
                                options={config().options()}
                                selected={config().selected()}
                                onSelectionChange={config().onChange}
                                isLoading={config().isLoading()}
                            />
                        </Show>
                    );
                }}
            </For>
        </Sheet>
    );
};
