import { Component, For, Show, createSignal, createMemo, createEffect } from 'solid-js';
import { ActionBadge } from './Badge';
import Checkbox from './Checkbox';
import { SearchInput } from './SearchInput';

// ============================================
// TYPES
// ============================================

export interface PermissionItem {
    id: number;
    slug: string;
    description?: string | null;
}

export interface PermissionMatrixProps {
    /** All available permissions */
    allPermissions: PermissionItem[];
    /** Currently selected permission IDs (controlled) */
    selectedIds: Set<number>;
    /** Callback when a single permission is toggled */
    onToggle: (permissionId: number) => void;
    /** Callback when an entire module is toggled */
    onModuleToggle: (prefix: string, selected: boolean) => void;
    /** Optional external search term — if omitted, renders its own SearchInput */
    search?: string;
    /** Module display name overrides */
    moduleLabels?: Record<string, string>;
    /** Whether to show the built-in search input */
    showSearch?: boolean;
}

// ============================================
// COMPONENT
// ============================================

/**
 * PermissionMatrix — Reusable widget for assigning permissions.
 * Renders permissions grouped by module with expand/collapse,
 * indeterminate module-level checkboxes, search, and ActionBadge per action.
 * Pure presentational — does NOT fetch data itself.
 */
export const PermissionMatrix: Component<PermissionMatrixProps> = (props) => {
    const [internalSearch, setInternalSearch] = createSignal('');
    const [expandedModules, setExpandedModules] = createSignal<Set<string>>(new Set());

    const search = () => props.search ?? internalSearch();

    // Group permissions by module (slug.split('.')[0])
    const grouped = createMemo(() => {
        const map = new Map<string, PermissionItem[]>();
        for (const perm of props.allPermissions) {
            const [module] = perm.slug.split('.');
            if (!map.has(module)) map.set(module, []);
            map.get(module)!.push(perm);
        }
        return map;
    });

    // Filter modules by search
    const filteredModules = createMemo(() => {
        const term = search().toLowerCase();
        if (!term) return Array.from(grouped().entries());

        return Array.from(grouped().entries()).filter(([module, perms]) => {
            const label = props.moduleLabels?.[module] ?? module;
            if (label.toLowerCase().includes(term)) return true;
            if (module.toLowerCase().includes(term)) return true;
            return perms.some(p =>
                p.slug.toLowerCase().includes(term) ||
                p.description?.toLowerCase().includes(term)
            );
        });
    });

    // Auto-expand all when searching
    createEffect(() => {
        if (search().length > 0) {
            setExpandedModules(new Set<string>(filteredModules().map(([m]) => m)));
        }
    });

    const toggleExpand = (module: string) => {
        const next = new Set(expandedModules());
        if (next.has(module)) { next.delete(module); } else { next.add(module); }
        setExpandedModules(next);
    };

    const expandAll = () => setExpandedModules(new Set(Array.from(grouped().keys())));
    const collapseAll = () => setExpandedModules(new Set());

    const moduleState = (perms: PermissionItem[]) => {
        let selected = 0;
        for (const p of perms) {
            if (props.selectedIds.has(p.id)) selected++;
        }
        if (selected === 0) return 'none' as const;
        if (selected === perms.length) return 'all' as const;
        return 'some' as const;
    };

    return (
        <div class="permission-matrix space-y-2">
            {/* Toolbar */}
            <div class="flex items-center justify-between gap-3 mb-3 sticky top-0 z-10 bg-card py-2 -mt-2">
                <Show when={props.showSearch !== false}>
                    <SearchInput
                        value={search()}
                        onSearch={setInternalSearch}
                        placeholder="Buscar permisos..."
                        class="flex-1"
                    />
                </Show>
                <div class="flex items-center gap-1 shrink-0">
                    <button
                        type="button"
                        onClick={expandAll}
                        class="text-xs px-2 py-1 rounded-md bg-surface hover:bg-surface/80 text-muted transition-colors"
                    >
                        Expandir
                    </button>
                    <button
                        type="button"
                        onClick={collapseAll}
                        class="text-xs px-2 py-1 rounded-md bg-surface hover:bg-surface/80 text-muted transition-colors"
                    >
                        Colapsar
                    </button>
                </div>
            </div>

            {/* Module Groups */}
            <div class="space-y-1">
                <For each={filteredModules()}>
                    {([module, perms]) => {
                        const state = () => moduleState(perms);
                        const isExpanded = () => expandedModules().has(module);
                        const label = () => props.moduleLabels?.[module] ?? module;

                        return (
                            <div class="border border-border rounded-xl overflow-hidden">
                                {/* Module header */}
                                <button
                                    type="button"
                                    onClick={() => toggleExpand(module)}
                                    class="w-full flex items-center gap-3 px-4 py-3 bg-surface/30 hover:bg-surface/50 transition-colors text-left"
                                >
                                    {/* Chevron */}
                                    <svg
                                        class={`w-4 h-4 text-muted transition-transform duration-200 ${isExpanded() ? 'rotate-90' : ''}`}
                                        fill="none" stroke="currentColor" viewBox="0 0 24 24"
                                    >
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
                                    </svg>

                                    {/* Module checkbox (select/deselect all) */}
                                    <Checkbox
                                        checked={state() === 'all'}
                                        indeterminate={state() === 'some'}
                                        onChange={() => props.onModuleToggle(module, state() !== 'all')}
                                        onClick={(e: MouseEvent) => e.stopPropagation()}
                                    />

                                    {/* Module label */}
                                    <span class="font-semibold text-sm flex-1 capitalize">{label()}</span>

                                    {/* Counter */}
                                    <span class="text-xs text-muted">
                                        {perms.filter(p => props.selectedIds.has(p.id)).length}/{perms.length}
                                    </span>
                                </button>

                                {/* Permissions list */}
                                <Show when={isExpanded()}>
                                    <div class="px-3 pb-3 space-y-1 border-t border-border pt-2">
                                        <For each={perms}>
                                            {(perm) => {
                                                const action = perm.slug.split('.')[1];
                                                return (
                                                    <label class={`flex items-center gap-2 p-2 rounded cursor-pointer transition-colors ${props.selectedIds.has(perm.id) ? 'bg-primary/5' : 'hover:bg-surface/30'}`}>
                                                        <Checkbox
                                                            checked={props.selectedIds.has(perm.id)}
                                                            onChange={() => props.onToggle(perm.id)}
                                                            onClick={(e: MouseEvent) => e.stopPropagation()}
                                                        />
                                                        <ActionBadge action={action} />
                                                        <span class="text-sm text-muted truncate">{perm.description}</span>
                                                    </label>
                                                );
                                            }}
                                        </For>
                                    </div>
                                </Show>
                            </div>
                        );
                    }}
                </For>
            </div>

            <Show when={filteredModules().length === 0}>
                <div class="text-center py-6 text-muted text-sm">
                    No se encontraron permisos
                </div>
            </Show>
        </div>
    );
};

export default PermissionMatrix;
