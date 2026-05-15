/**
 * SettingsTable<T> — Generic table for Settings module lists (v2).
 *
 * Features:
 *  - Inline client-side search (debounced)
 *  - Active/Inactive/All filter via SegmentedControl
 *  - Item counter pill in header
 *  - Improved empty state with SVG icon + CTA slot
 *  - Optional groupBy support for grouped display (e.g., UOM groups)
 *  - Outlet for deep-linked sheets
 */
import { Component, For, Show, JSX, createSignal, createMemo } from 'solid-js';
import { Outlet } from '@tanstack/solid-router';
import { SkeletonLoader } from '@shared/ui/SkeletonLoader';
import { StatusBadge } from '@shared/ui/Badge';
import { EditIcon, SearchIcon, BoxIcon } from '@shared/ui/icons';
import type { IconProps } from '@shared/ui/icons';
import {
    SegmentedControl,
    SegmentedControlIndicator,
    SegmentedControlItem,
    SegmentedControlItemInput,
    SegmentedControlItemLabel,
} from '@shared/ui/SegmentedControl';

// ── Types ──

export interface SettingsColumn<T> {
    key: string;
    label: string;
    /** 'auto' = 1fr. Use CSS grid values like '80px', '100px' */
    width?: string;
    align?: 'left' | 'center' | 'right';
    render: (item: T) => JSX.Element;
}

export interface SettingsGroupConfig<T> {
    /** Key to group items by */
    keyFn: (item: T) => string;
    /** Display label for each group */
    label: (groupKey: string) => string;
    /** SVG icon component for each group */
    icon: (groupKey: string) => Component<IconProps>;
    /** Order groups (optional) */
    order?: string[];
}

export interface SettingsTableProps<T> {
    /** Query data — raw array */
    data: T[] | undefined;
    /** Loading state */
    isLoading: boolean;
    /** Column definitions */
    columns: SettingsColumn<T>[];

    // ── Header ──
    /** Section title */
    title: string;
    /** Section description */
    description?: string;
    /** Optional slot for extra header content */
    headerActions?: JSX.Element;

    // ── Search ──
    /** Enable client-side search */
    searchable?: boolean;
    /** Custom search placeholder */
    searchPlaceholder?: string;
    /** Keys to search against. Defaults to searching all string values */
    searchFn?: (item: T, term: string) => boolean;

    // ── Grouping ──
    /** Group configuration for grouped display (e.g., UOM groups) */
    groupBy?: SettingsGroupConfig<T>;

    // ── Empty State ──
    /** Empty state message */
    emptyMessage?: string;
    /** SVG icon for empty state */
    emptyIcon?: JSX.Element;
    /** CTA element for empty state (e.g., "Create" button) */
    emptyCta?: JSX.Element;

    // ── Row interactions ──
    /** Row click handler */
    onRowClick?: (item: T) => void;
    /** Edit click handler (pencil icon) */
    onEdit?: (item: T) => void;
    /** Toggle active (deactivate/restore) */
    onToggleActive?: (item: T) => void;
    /** Extract is_active from item */
    getIsActive?: (item: T) => boolean;

    /** Whether to render <Outlet/> for deep-linked sheets */
    hasOutlet?: boolean;
}

// ── Filter options ──
type StatusFilter = 'all' | 'active' | 'inactive';
const FILTER_OPTIONS: { value: StatusFilter; label: string }[] = [
    { value: 'all', label: 'Todos' },
    { value: 'active', label: 'Activos' },
    { value: 'inactive', label: 'Inactivos' },
];

function SettingsTable<T>(props: SettingsTableProps<T>) {
    const [searchTerm, setSearchTerm] = createSignal('');
    const [statusFilter, setStatusFilter] = createSignal<StatusFilter>('all');

    const rawItems = () => (props.data ?? []) as T[];
    const isActiveFor = (item: T) => props.getIsActive ? props.getIsActive(item) : true;

    // Apply search + status filter
    const filteredItems = createMemo(() => {
        let items = rawItems();

        // Status filter
        if (props.getIsActive && statusFilter() !== 'all') {
            const wantActive = statusFilter() === 'active';
            items = items.filter(item => isActiveFor(item) === wantActive);
        }

        // Search
        const term = searchTerm().trim().toLowerCase();
        if (term && props.searchable) {
            if (props.searchFn) {
                items = items.filter(item => props.searchFn!(item, term));
            } else {
                // Default: search all string values
                items = items.filter(item => {
                    const values = Object.values(item as Record<string, unknown>);
                    return values.some(v =>
                        typeof v === 'string' && v.toLowerCase().includes(term)
                    );
                });
            }
        }

        return items;
    });

    // Build grid template from columns + status + actions columns
    const gridTemplate = () => {
        const cols = props.columns.map(c => c.width ?? '1fr');
        if (props.getIsActive) cols.push('80px');
        if (props.onEdit || props.onToggleActive) cols.push('100px');
        return cols.join(' ');
    };

    // ── Grouped rendering ──
    const groupedData = createMemo(() => {
        if (!props.groupBy) return null;
        const groups: Record<string, T[]> = {};
        for (const item of filteredItems()) {
            const key = props.groupBy.keyFn(item);
            if (!groups[key]) groups[key] = [];
            groups[key].push(item);
        }
        // Order groups if specified
        if (props.groupBy.order) {
            const ordered: [string, T[]][] = [];
            for (const key of props.groupBy.order) {
                if (groups[key]) ordered.push([key, groups[key]]);
            }
            // Add any groups not in the order list
            for (const [key, items] of Object.entries(groups)) {
                if (!props.groupBy.order!.includes(key)) ordered.push([key, items]);
            }
            return ordered;
        }
        return Object.entries(groups);
    });

    // ── Search input handler ──
    let searchTimeout: number;
    const handleSearchInput = (value: string) => {
        clearTimeout(searchTimeout);
        searchTimeout = window.setTimeout(() => setSearchTerm(value), 200);
    };

    return (
        <>
            {props.hasOutlet !== false && <Outlet />}

            <div class="space-y-3">
                {/* ── Header row ── */}
                <div class="flex items-start sm:items-center justify-between gap-3 flex-col sm:flex-row">
                    <div class="flex items-center gap-2.5 min-w-0">
                        <h2 class="text-lg font-semibold text-text">{props.title}</h2>
                        {/* Item count pill */}
                        <Show when={!props.isLoading && rawItems().length > 0}>
                            <span class="px-2 py-0.5 text-[11px] font-semibold rounded-full bg-primary/10 text-primary tabular-nums">
                                {rawItems().length}
                            </span>
                        </Show>
                    </div>
                    {props.headerActions}
                </div>

                <Show when={props.description}>
                    <p class="text-xs text-muted -mt-1">{props.description}</p>
                </Show>

                {/* ── Toolbar: search + filter ── */}
                <Show when={(props.searchable || props.getIsActive) && !props.isLoading && rawItems().length > 0}>
                    <div class="flex items-center gap-3 flex-wrap">
                        {/* Search */}
                        <Show when={props.searchable}>
                            <div class="relative flex-1 min-w-[180px] max-w-xs">
                                <div class="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none">
                                    <SearchIcon class="size-3.5 text-muted" />
                                </div>
                                <input
                                    type="text"
                                    placeholder={props.searchPlaceholder ?? 'Buscar...'}
                                    onInput={(e) => handleSearchInput(e.currentTarget.value)}
                                    class="w-full bg-surface/40 border border-border text-text text-sm rounded-lg pl-8 pr-3 py-1.5 placeholder:text-muted/60 hover:border-border-strong focus:border-primary focus:ring-2 focus:ring-primary/15 outline-hidden transition-colors"
                                />
                            </div>
                        </Show>

                        {/* Status filter */}
                        <Show when={props.getIsActive}>
                            <SegmentedControl
                                value={statusFilter()}
                                onChange={(v) => v && setStatusFilter(v as StatusFilter)}
                                class="text-xs"
                            >
                                <SegmentedControlIndicator />
                                <For each={FILTER_OPTIONS}>
                                    {(opt) => (
                                        <SegmentedControlItem value={opt.value}>
                                            <SegmentedControlItemInput />
                                            <SegmentedControlItemLabel class="!text-xs !px-2.5 !py-1.5">
                                                {opt.label}
                                            </SegmentedControlItemLabel>
                                        </SegmentedControlItem>
                                    )}
                                </For>
                            </SegmentedControl>
                        </Show>

                        {/* Filtered count (when filtering is active) */}
                        <Show when={searchTerm().trim() || statusFilter() !== 'all'}>
                            <span class="text-[11px] text-muted">
                                {filteredItems().length} de {rawItems().length}
                            </span>
                        </Show>
                    </div>
                </Show>

                {/* ── Table content ── */}
                <Show when={!props.isLoading} fallback={<SkeletonLoader type="table-row" count={4} />}>
                    <Show
                        when={filteredItems().length > 0}
                        fallback={
                            <EmptyState
                                icon={props.emptyIcon}
                                message={
                                    searchTerm().trim() || statusFilter() !== 'all'
                                        ? 'No se encontraron resultados con los filtros aplicados.'
                                        : (props.emptyMessage ?? 'No hay elementos creados aún.')
                                }
                                cta={!(searchTerm().trim() || statusFilter() !== 'all') ? props.emptyCta : undefined}
                            />
                        }
                    >
                        {/* Grouped display */}
                        <Show when={props.groupBy && groupedData()}>
                            <div class="space-y-4">
                                <For each={groupedData()!}>
                                    {([groupKey, groupItems]) => {
                                        const GroupIcon = props.groupBy!.icon(groupKey);
                                        return (
                                            <div class="border border-border rounded-xl overflow-hidden">
                                                {/* Group header */}
                                                <div class="px-4 py-2 bg-surface/40 border-b border-border/50 flex items-center gap-2">
                                                    <GroupIcon class="size-4 text-primary" />
                                                    <span class="text-xs font-semibold uppercase tracking-wider text-primary">
                                                        {props.groupBy!.label(groupKey)}
                                                    </span>
                                                    <span class="text-[10px] text-muted bg-surface/60 px-1.5 py-0.5 rounded-full font-mono">
                                                        {(groupItems as T[]).length}
                                                    </span>
                                                </div>
                                                {/* Column header */}
                                                <TableHeader columns={props.columns} gridTemplate={gridTemplate()} hasStatus={!!props.getIsActive} hasActions={!!(props.onEdit || props.onToggleActive)} />
                                                {/* Rows */}
                                                <div class="divide-y divide-border/30">
                                                    <For each={groupItems as T[]}>
                                                        {(item) => (
                                                            <TableRow
                                                                item={item}
                                                                columns={props.columns}
                                                                gridTemplate={gridTemplate()}
                                                                isActive={isActiveFor(item)}
                                                                hasStatus={!!props.getIsActive}
                                                                hasActions={!!(props.onEdit || props.onToggleActive)}
                                                                onRowClick={props.onRowClick}
                                                                onEdit={props.onEdit}
                                                                onToggleActive={props.onToggleActive}
                                                            />
                                                        )}
                                                    </For>
                                                </div>
                                            </div>
                                        );
                                    }}
                                </For>
                            </div>
                        </Show>

                        {/* Flat display (no groupBy) */}
                        <Show when={!props.groupBy}>
                            <div class="border border-border rounded-xl overflow-hidden divide-y divide-border/50">
                                <TableHeader columns={props.columns} gridTemplate={gridTemplate()} hasStatus={!!props.getIsActive} hasActions={!!(props.onEdit || props.onToggleActive)} />
                                <For each={filteredItems()}>
                                    {(item) => (
                                        <TableRow
                                            item={item}
                                            columns={props.columns}
                                            gridTemplate={gridTemplate()}
                                            isActive={isActiveFor(item)}
                                            hasStatus={!!props.getIsActive}
                                            hasActions={!!(props.onEdit || props.onToggleActive)}
                                            onRowClick={props.onRowClick}
                                            onEdit={props.onEdit}
                                            onToggleActive={props.onToggleActive}
                                        />
                                    )}
                                </For>
                            </div>
                        </Show>
                    </Show>
                </Show>
            </div>
        </>
    );
}

// ── Sub-components ──

function TableHeader<T>(props: {
    columns: SettingsColumn<T>[];
    gridTemplate: string;
    hasStatus: boolean;
    hasActions: boolean;
}) {
    return (
        <div
            class="gap-4 px-4 py-2.5 bg-surface/30 text-xs font-semibold uppercase tracking-wider text-muted"
            style={{ display: 'grid', "grid-template-columns": props.gridTemplate }}
        >
            <For each={props.columns}>
                {(col) => (
                    <span classList={{
                        'text-center': col.align === 'center',
                        'text-right': col.align === 'right',
                    }}>
                        {col.label}
                    </span>
                )}
            </For>
            <Show when={props.hasStatus}>
                <span class="text-center">Estado</span>
            </Show>
            <Show when={props.hasActions}>
                <span class="text-right">Acciones</span>
            </Show>
        </div>
    );
}

function TableRow<T>(props: {
    item: T;
    columns: SettingsColumn<T>[];
    gridTemplate: string;
    isActive: boolean;
    hasStatus: boolean;
    hasActions: boolean;
    onRowClick?: (item: T) => void;
    onEdit?: (item: T) => void;
    onToggleActive?: (item: T) => void;
}) {
    return (
        <div
            class="gap-4 px-4 py-2.5 items-center hover:bg-surface/20 transition-colors group"
            classList={{ 'cursor-pointer': !!props.onRowClick }}
            style={{ display: 'grid', "grid-template-columns": props.gridTemplate }}
            onClick={() => props.onRowClick?.(props.item)}
        >
            <For each={props.columns}>
                {(col) => (
                    <div classList={{
                        'text-center': col.align === 'center',
                        'text-right': col.align === 'right',
                    }}>
                        {col.render(props.item)}
                    </div>
                )}
            </For>
            <Show when={props.hasStatus}>
                <div class="flex justify-center">
                    <StatusBadge isActive={props.isActive} />
                </div>
            </Show>
            <Show when={props.hasActions}>
                <div class="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Show when={props.onEdit}>
                        <button
                            class="size-7 flex items-center justify-center rounded-lg hover:bg-primary/10 text-muted hover:text-primary transition-colors"
                            onClick={(e) => { e.stopPropagation(); props.onEdit!(props.item); }}
                            title="Editar"
                        >
                            <EditIcon class="size-3.5" />
                        </button>
                    </Show>
                    <Show when={props.onToggleActive}>
                        <button
                            class="text-xs px-2 py-1 rounded-lg transition-colors"
                            classList={{
                                'hover:bg-danger/10 text-muted hover:text-danger': props.isActive,
                                'hover:bg-emerald-500/10 text-muted hover:text-emerald-500': !props.isActive,
                            }}
                            onClick={(e) => { e.stopPropagation(); props.onToggleActive!(props.item); }}
                        >
                            {props.isActive ? 'Desactivar' : 'Restaurar'}
                        </button>
                    </Show>
                </div>
            </Show>
        </div>
    );
}

// ── Empty State ──
const EmptyState: Component<{
    icon?: JSX.Element;
    message: string;
    cta?: JSX.Element;
}> = (props) => (
    <div class="flex flex-col items-center justify-center py-14 text-muted">
        <div class="mb-3">
            {props.icon ?? <BoxIcon class="size-10 text-muted/25" />}
        </div>
        <p class="text-sm text-center max-w-xs">{props.message}</p>
        <Show when={props.cta}>
            <div class="mt-4">{props.cta}</div>
        </Show>
    </div>
);

export default SettingsTable;
