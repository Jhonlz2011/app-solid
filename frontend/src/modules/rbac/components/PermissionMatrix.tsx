import { Component, For, Show, createSignal, createMemo, createEffect } from 'solid-js';
import {
    RBAC_MODULE_CATEGORIES,
    getRbacModuleLabel,
    getRbacActionLabel,
    getRbacPermissionDescription,
} from '@app/schema/utils';
import { ActionBadge } from '@display/Badge';
import Checkbox from '@form/Checkbox';
import { SearchInput } from '@form/SearchInput';
import Button from '@form/Button';
import { ChevronRightIcon } from '@icons/ChevronRightIcon';
import { LockIcon } from '@icons/LockIcon';

// ============================================
// TYPES
// ============================================

export interface PermissionItem {
    slug: string;
    module?: string;
    action?: string;
    description?: string | null;
    planAllowed?: boolean;
}

export interface PermissionMatrixProps {
    /** All available permissions */
    allPermissions: PermissionItem[];
    /** Currently selected permission slugs (controlled) */
    selectedSlugs: Set<string>;
    /** Callback when a single permission is toggled */
    onToggle: (slug: string) => void;
    /** Callback when an entire module is toggled */
    onModuleToggle: (prefix: string, selected: boolean) => void;
    /** Optional bulk selection callback for quick preset buttons */
    onBulkSelect?: (slugs: string[]) => void;
    /** Optional external search term — if omitted, renders its own SearchInput */
    search?: string;
    /** Module display name overrides */
    moduleLabels?: Record<string, string>;
    /** Whether to show the built-in search input */
    showSearch?: boolean;
    /** Disables all toggles (read-only mode) */
    disabled?: boolean;
    /** Actions blocked for this role (e.g. ['delete', 'destroy'] for contador) */
    blockedActions?: readonly string[];
    /** Tooltip reason shown on blocked action checkboxes */
    blockedActionsReason?: string;
}

interface ModuleGroup {
    module: string;
    label: string;
    perms: PermissionItem[];
}

interface CategoryGroup {
    id: string;
    label: string;
    modules: ModuleGroup[];
}

// ============================================
// COMPONENT
// ============================================

/**
 * PermissionMatrix — Reusable widget for assigning permissions.
 * Renders permissions grouped by business category and module in Spanish,
 * with quick presets, indeterminate module checkboxes, search, and ActionBadge per action.
 * Single source of truth for labels: `@app/schema/utils`.
 */
export const PermissionMatrix: Component<PermissionMatrixProps> = (props) => {
    const [internalSearch, setInternalSearch] = createSignal('');
    const [expandedModules, setExpandedModules] = createSignal<Set<string>>(new Set());

    const search = () => props.search ?? internalSearch();
    const isDisabled = () => Boolean(props.disabled);
    const blockedSet = createMemo(() => new Set(props.blockedActions ?? []));

    const isActionBlocked = (action: string) => blockedSet().has(action);

    // Allowed permissions (omitting uncontracted plan modules)
    const allowedPermissions = createMemo(() =>
        props.allPermissions.filter(p => p.planAllowed !== false)
    );

    // Group permissions by module
    const groupedByModule = createMemo(() => {
        const map = new Map<string, PermissionItem[]>();
        for (const perm of allowedPermissions()) {
            const moduleName = perm.module || perm.slug.split('.')[0];
            if (!map.has(moduleName)) map.set(moduleName, []);
            map.get(moduleName)!.push(perm);
        }
        return map;
    });

    const resolveModuleLabel = (moduleName: string) =>
        props.moduleLabels?.[moduleName] ?? getRbacModuleLabel(moduleName);

    // Group modules by business category + filter by search (Spanish labels, actions, descriptions)
    const categorizedGroups = createMemo<CategoryGroup[]>(() => {
        const term = search().trim().toLowerCase();
        const modMap = groupedByModule();
        const assignedModules = new Set<string>();

        const matchesModule = (moduleName: string, perms: PermissionItem[], categoryLabel: string) => {
            if (!term) return true;
            if (categoryLabel.toLowerCase().includes(term)) return true;
            if (resolveModuleLabel(moduleName).toLowerCase().includes(term)) return true;
            if (moduleName.toLowerCase().includes(term)) return true;
            return perms.some(p => {
                const action = p.action || p.slug.split('.')[1] || '';
                const actionLabel = getRbacActionLabel(action).toLowerCase();
                const desc = (p.description || getRbacPermissionDescription(moduleName, action)).toLowerCase();
                return p.slug.toLowerCase().includes(term) || actionLabel.includes(term) || desc.includes(term);
            });
        };

        const categories: CategoryGroup[] = [];

        for (const cat of RBAC_MODULE_CATEGORIES) {
            const modules: ModuleGroup[] = [];
            for (const modName of cat.modules) {
                const perms = modMap.get(modName);
                if (!perms || perms.length === 0) continue;
                assignedModules.add(modName);
                if (matchesModule(modName, perms, cat.label)) {
                    modules.push({ module: modName, label: resolveModuleLabel(modName), perms });
                }
            }
            if (modules.length > 0) {
                categories.push({ id: cat.key, label: cat.label, modules });
            }
        }

        // Fallback category for any module not yet listed in RBAC_MODULE_CATEGORIES
        const uncategorized: ModuleGroup[] = [];
        for (const [modName, perms] of modMap.entries()) {
            if (assignedModules.has(modName)) continue;
            if (matchesModule(modName, perms, 'Otros módulos')) {
                uncategorized.push({ module: modName, label: resolveModuleLabel(modName), perms });
            }
        }
        if (uncategorized.length > 0) {
            categories.push({ id: 'otros', label: 'Otros módulos', modules: uncategorized });
        }

        return categories;
    });

    const visibleModuleNames = createMemo(() =>
        categorizedGroups().flatMap(c => c.modules.map(m => m.module))
    );

    // Auto-expand matched modules while searching
    createEffect(() => {
        if (search().trim().length > 0) {
            setExpandedModules(new Set<string>(visibleModuleNames()));
        } else {
            setExpandedModules(new Set<string>());
        }
    });

    const toggleExpand = (module: string) => {
        const next = new Set(expandedModules());
        if (next.has(module)) next.delete(module);
        else next.add(module);
        setExpandedModules(next);
    };

    const expandAll = () => setExpandedModules(new Set(Array.from(groupedByModule().keys())));
    const collapseAll = () => setExpandedModules(new Set<string>());

    const selectablePerms = (perms: PermissionItem[]) =>
        perms.filter(p => !isActionBlocked(p.action || p.slug.split('.')[1] || ''));

    const moduleState = (perms: PermissionItem[]) => {
        const eligible = selectablePerms(perms);
        if (eligible.length === 0) return 'none' as const;
        let selected = 0;
        for (const p of eligible) {
            if (props.selectedSlugs.has(p.slug)) selected++;
        }
        if (selected === 0) return 'none' as const;
        if (selected === eligible.length) return 'all' as const;
        return 'some' as const;
    };

    // Quick preset handlers
    const handleSelectReadOnly = () => {
        if (isDisabled() || !props.onBulkSelect) return;
        const slugs = allowedPermissions()
            .filter(p => (p.action || p.slug.split('.')[1]) === 'read' && !isActionBlocked('read'))
            .map(p => p.slug);
        props.onBulkSelect(slugs);
    };

    const handleSelectAll = () => {
        if (isDisabled() || !props.onBulkSelect) return;
        const slugs = allowedPermissions()
            .filter(p => !isActionBlocked(p.action || p.slug.split('.')[1] || ''))
            .map(p => p.slug);
        props.onBulkSelect(slugs);
    };

    const handleClearAll = () => {
        if (isDisabled() || !props.onBulkSelect) return;
        props.onBulkSelect([]);
    };

    const totalSelectableCount = createMemo(() =>
        allowedPermissions().filter(p => !isActionBlocked(p.action || p.slug.split('.')[1] || '')).length
    );

    const selectedAllowedCount = createMemo(() => {
        let count = 0;
        for (const p of allowedPermissions()) {
            if (props.selectedSlugs.has(p.slug)) count++;
        }
        return count;
    });

    return (
        <div class="permission-matrix space-y-3">
            {/* Sticky Toolbar */}
            <div class="space-y-2 sticky top-0 z-10 bg-card py-2 -mt-2 border-b border-border/40">
                <div class="flex items-center justify-between gap-2">
                    <Show when={props.showSearch !== false}>
                        <SearchInput
                            value={search()}
                            onSearch={setInternalSearch}
                            placeholder="Buscar módulo, acción o descripción..."
                            class="flex-1"
                        />
                    </Show>
                    <div class="flex items-center gap-1 shrink-0">
                        <Button type="button" variant="ghost" size="sm" onClick={expandAll}>
                            Expandir
                        </Button>
                        <Button type="button" variant="ghost" size="sm" onClick={collapseAll}>
                            Colapsar
                        </Button>
                    </div>
                </div>

                {/* Quick Presets & Counter */}
                <div class="flex flex-wrap items-center justify-between gap-2 text-xs">
                    <Show when={!isDisabled() && props.onBulkSelect}>
                        <div class="flex flex-wrap items-center gap-1.5">
                            <span class="text-muted mr-1">Atajos:</span>
                            <button
                                type="button"
                                onClick={handleSelectReadOnly}
                                class="px-2 py-1 rounded-lg border border-border bg-surface/50 hover:bg-surface text-text font-medium transition-colors"
                            >
                                Solo lectura
                            </button>
                            <button
                                type="button"
                                onClick={handleSelectAll}
                                class="px-2 py-1 rounded-lg border border-border bg-surface/50 hover:bg-surface text-text font-medium transition-colors"
                            >
                                Seleccionar todo
                            </button>
                            <button
                                type="button"
                                onClick={handleClearAll}
                                class="px-2 py-1 rounded-lg border border-border bg-surface/50 hover:bg-danger/10 hover:text-danger hover:border-danger/30 text-muted font-medium transition-colors"
                            >
                                Limpiar
                            </button>
                        </div>
                    </Show>
                    <span class="text-muted tabular-nums ml-auto">
                        <strong class="text-text">{selectedAllowedCount()}</strong> / {totalSelectableCount()} permisos seleccionados
                    </span>
                </div>
            </div>

            {/* Category -> Module Groups */}
            <div class="space-y-4">
                <For each={categorizedGroups()}>
                    {(category) => (
                        <div class="space-y-1.5">
                            <div class="flex items-center gap-2 px-1">
                                <span class="text-[11px] font-semibold uppercase tracking-wider text-muted">
                                    {category.label}
                                </span>
                                <div class="h-px flex-1 bg-border/50" />
                            </div>

                            <div class="space-y-1.5">
                                <For each={category.modules}>
                                    {(group) => {
                                        const state = () => moduleState(group.perms);
                                        const isExpanded = () => expandedModules().has(group.module);
                                        const selectedInMod = () => group.perms.filter(p => props.selectedSlugs.has(p.slug)).length;

                                        return (
                                            <div class="border border-border/80 rounded-xl overflow-hidden bg-card">
                                                {/* Module header */}
                                                <button
                                                    type="button"
                                                    onClick={() => toggleExpand(group.module)}
                                                    class="w-full flex items-center gap-3 px-3.5 py-2.5 bg-surface/30 hover:bg-surface/50 transition-colors text-left"
                                                >
                                                    <ChevronRightIcon
                                                        class={`size-4 text-muted transition-transform duration-200 shrink-0 ${isExpanded() ? 'rotate-90' : ''}`}
                                                    />

                                                    <div onClick={(e: MouseEvent) => e.stopPropagation()}>
                                                        <Checkbox
                                                            checked={state() === 'all'}
                                                            indeterminate={state() === 'some'}
                                                            disabled={isDisabled()}
                                                            onChange={() => props.onModuleToggle(group.module, state() !== 'all')}
                                                        />
                                                    </div>

                                                    <span class="font-semibold text-sm text-text flex-1 truncate">
                                                        {group.label}
                                                    </span>

                                                    <span
                                                        class="text-xs px-2 py-0.5 rounded-full tabular-nums font-medium"
                                                        classList={{
                                                            'bg-primary/10 text-primary': selectedInMod() > 0,
                                                            'bg-surface text-muted': selectedInMod() === 0,
                                                        }}
                                                    >
                                                        {selectedInMod()}/{group.perms.length}
                                                    </span>
                                                </button>

                                                {/* Permissions grid */}
                                                <Show when={isExpanded()}>
                                                    <div class="p-2.5 grid grid-cols-1 sm:grid-cols-2 gap-1.5 border-t border-border/60 bg-card">
                                                        <For each={group.perms}>
                                                            {(perm) => {
                                                                const action = perm.action || perm.slug.split('.')[1] || '';
                                                                const blocked = () => isActionBlocked(action);
                                                                const checked = () => props.selectedSlugs.has(perm.slug);
                                                                const description = () =>
                                                                    perm.description || getRbacPermissionDescription(group.module, action);

                                                                return (
                                                                    <label
                                                                        title={blocked()
                                                                            ? (props.blockedActionsReason || 'Acción restringida para este rol')
                                                                            : description()
                                                                        }
                                                                        class={`flex items-center gap-2.5 p-2 rounded-lg border transition-colors ${
                                                                            blocked()
                                                                                ? 'opacity-50 cursor-not-allowed border-border/40 bg-surface/20'
                                                                                : isDisabled()
                                                                                    ? 'cursor-default border-transparent bg-surface/10'
                                                                                    : checked()
                                                                                        ? 'cursor-pointer border-primary/25 bg-primary/5'
                                                                                        : 'cursor-pointer border-transparent hover:bg-surface/40'
                                                                        }`}
                                                                    >
                                                                        <div onClick={(e: MouseEvent) => e.stopPropagation()}>
                                                                            <Checkbox
                                                                                checked={checked()}
                                                                                disabled={isDisabled() || blocked()}
                                                                                onChange={() => {
                                                                                    if (!isDisabled() && !blocked()) {
                                                                                        props.onToggle(perm.slug);
                                                                                    }
                                                                                }}
                                                                            />
                                                                        </div>
                                                                        <ActionBadge action={action} />
                                                                        <span class="text-xs text-muted truncate flex-1">
                                                                            {description()}
                                                                        </span>
                                                                        <Show when={blocked()}>
                                                                            <LockIcon class="size-3.5 text-muted shrink-0" />
                                                                        </Show>
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
                        </div>
                    )}
                </For>
            </div>

            <Show when={categorizedGroups().length === 0}>
                <div class="text-center py-8 text-muted text-sm">
                    No se encontraron permisos para &ldquo;{search()}&rdquo;
                </div>
            </Show>
        </div>
    );
};

export default PermissionMatrix;
