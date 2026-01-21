import { Component, For, Show, createSignal, createMemo, createEffect } from 'solid-js';

// Types
interface MenuItemData {
    id: number;
    key: string;
    label: string;
    icon?: string;
    path?: string;
    parent_id: number | null;
    sort_order: number;
    permission_prefix?: string;
    children?: MenuItemData[];
}

interface Permission {
    id: number;
    slug: string;
    description?: string;
}

interface MenuTreeViewProps {
    menus: MenuItemData[];
    allPermissions: Permission[];
    selectedPermissionIds: Set<number>;
    onPermissionToggle: (permissionId: number) => void;
    onModuleToggle: (prefix: string, selected: boolean) => void;
    search?: string;
}

// Permission action labels
const PERMISSION_ACTIONS = [
    { key: 'read', label: 'Ver', shortLabel: 'V' },
    { key: 'add', label: 'Crear', shortLabel: 'C' },
    { key: 'edit', label: 'Editar', shortLabel: 'E' },
    { key: 'delete', label: 'Eliminar', shortLabel: 'D' },
];

/**
 * MenuTreeView - Modern tree view for permission assignment
 * Displays menus hierarchically with permission toggles for each item
 */
export const MenuTreeView: Component<MenuTreeViewProps> = (props) => {
    const [expandedIds, setExpandedIds] = createSignal<Set<number>>(new Set());

    // Build permission lookup by prefix
    const permissionsByPrefix = createMemo(() => {
        const map = new Map<string, Permission[]>();
        for (const perm of props.allPermissions) {
            const [prefix] = perm.slug.split('.');
            if (!map.has(prefix)) map.set(prefix, []);
            map.get(prefix)!.push(perm);
        }
        return map;
    });

    // Filter menus based on search
    const filteredMenus = createMemo(() => {
        if (!props.search) return props.menus;
        const term = props.search.toLowerCase();
        return filterMenuTree(props.menus, term);
    });

    // Auto-expand when searching
    createEffect(() => {
        if (props.search && props.search.length > 0) {
            const allIds = new Set<number>();
            const collectIds = (items: MenuItemData[]) => {
                for (const item of items) {
                    allIds.add(item.id);
                    if (item.children) collectIds(item.children);
                }
            };
            collectIds(filteredMenus());
            setExpandedIds(allIds);
        }
    });

    const toggleExpand = (id: number) => {
        const newSet = new Set(expandedIds());
        if (newSet.has(id)) {
            newSet.delete(id);
        } else {
            newSet.add(id);
        }
        setExpandedIds(newSet);
    };

    const expandAll = () => {
        const allIds = new Set<number>();
        const collectIds = (items: MenuItemData[]) => {
            for (const item of items) {
                if (item.children && item.children.length > 0) {
                    allIds.add(item.id);
                }
                if (item.children) collectIds(item.children);
            }
        };
        collectIds(props.menus);
        setExpandedIds(allIds);
    };

    const collapseAll = () => {
        setExpandedIds(new Set());
    };

    return (
        <div class="menu-tree-view">
            {/* Toolbar */}
            <div class="flex items-center justify-between mb-4 pb-3 border-b border-border">
                <div class="flex items-center gap-2">
                    <button
                        onClick={expandAll}
                        class="text-xs px-2 py-1 rounded-md bg-surface hover:bg-surface/80 text-muted transition-colors"
                    >
                        Expandir todo
                    </button>
                    <button
                        onClick={collapseAll}
                        class="text-xs px-2 py-1 rounded-md bg-surface hover:bg-surface/80 text-muted transition-colors"
                    >
                        Colapsar todo
                    </button>
                </div>
                <div class="flex items-center gap-1 text-xs text-muted">
                    <For each={PERMISSION_ACTIONS}>
                        {(action) => (
                            <span class="w-8 text-center font-medium">{action.shortLabel}</span>
                        )}
                    </For>
                </div>
            </div>

            {/* Tree */}
            <div class="space-y-1">
                <For each={filteredMenus()}>
                    {(menu) => (
                        <TreeNode
                            menu={menu}
                            depth={0}
                            permissionsByPrefix={permissionsByPrefix()}
                            selectedIds={props.selectedPermissionIds}
                            expandedIds={expandedIds()}
                            onToggleExpand={toggleExpand}
                            onPermissionToggle={props.onPermissionToggle}
                            onModuleToggle={props.onModuleToggle}
                        />
                    )}
                </For>
            </div>

            <Show when={filteredMenus().length === 0}>
                <div class="text-center py-8 text-muted">
                    No se encontraron menús
                </div>
            </Show>
        </div>
    );
};

// ============================================
// TREE NODE COMPONENT
// ============================================

interface TreeNodeProps {
    menu: MenuItemData;
    depth: number;
    permissionsByPrefix: Map<string, Permission[]>;
    selectedIds: Set<number>;
    expandedIds: Set<number>;
    onToggleExpand: (id: number) => void;
    onPermissionToggle: (id: number) => void;
    onModuleToggle: (prefix: string, selected: boolean) => void;
}

const TreeNode: Component<TreeNodeProps> = (props) => {
    const hasChildren = () => props.menu.children && props.menu.children.length > 0;
    const isExpanded = () => props.expandedIds.has(props.menu.id);

    // Get permissions for this menu's prefix
    const menuPermissions = createMemo(() => {
        if (!props.menu.permission_prefix) return [];
        return props.permissionsByPrefix.get(props.menu.permission_prefix) ?? [];
    });

    // Check if all permissions for this module are selected
    const allSelected = createMemo(() => {
        const perms = menuPermissions();
        if (perms.length === 0) return false;
        return perms.every(p => props.selectedIds.has(p.id));
    });

    const someSelected = createMemo(() => {
        const perms = menuPermissions();
        if (perms.length === 0) return false;
        const selectedCount = perms.filter(p => props.selectedIds.has(p.id)).length;
        return selectedCount > 0 && selectedCount < perms.length;
    });

    // Get permission ID by action (read, add, edit, delete)
    const getPermissionByAction = (action: string): Permission | undefined => {
        return menuPermissions().find(p => p.slug.endsWith('.' + action));
    };

    const toggleAllPermissions = () => {
        if (!props.menu.permission_prefix) return;
        props.onModuleToggle(props.menu.permission_prefix, !allSelected());
    };

    return (
        <div class="menu-tree-node">
            {/* Node Row */}
            <div
                class="group flex items-center gap-2 py-2 px-3 rounded-lg hover:bg-surface/60 transition-colors"
                style={{ "padding-left": `${props.depth * 24 + 12}px` }}
            >
                {/* Expand/Collapse */}
                <button
                    onClick={() => hasChildren() && props.onToggleExpand(props.menu.id)}
                    class={`w-5 h-5 flex items-center justify-center rounded transition-colors ${hasChildren() ? 'hover:bg-surface cursor-pointer' : 'cursor-default'
                        }`}
                >
                    <Show when={hasChildren()}>
                        <svg
                            class={`w-4 h-4 text-muted transition-transform duration-200 ${isExpanded() ? 'rotate-90' : ''}`}
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                        >
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
                        </svg>
                    </Show>
                </button>

                {/* Icon */}
                <Show when={props.menu.icon}>
                    <div class="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                        <svg class="w-4 h-4 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d={props.menu.icon} />
                        </svg>
                    </div>
                </Show>

                {/* Label */}
                <div class="flex-1 min-w-0">
                    <span class="text-sm font-medium truncate">{props.menu.label}</span>
                    <Show when={props.menu.permission_prefix}>
                        <span class="ml-2 text-xs text-muted">({props.menu.permission_prefix})</span>
                    </Show>
                </div>

                {/* Module Toggle (select all) */}
                <Show when={menuPermissions().length > 0}>
                    <button
                        onClick={toggleAllPermissions}
                        class="mr-2 p-1 rounded hover:bg-primary/10 transition-colors"
                        title={allSelected() ? 'Quitar todos' : 'Seleccionar todos'}
                    >
                        <svg class={`w-4 h-4 ${allSelected() ? 'text-primary' : 'text-muted'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                    </button>
                </Show>

                {/* Permission Toggles */}
                <div class="flex items-center gap-1">
                    <For each={PERMISSION_ACTIONS}>
                        {(action) => {
                            const perm = getPermissionByAction(action.key);
                            const isSelected = () => perm ? props.selectedIds.has(perm.id) : false;

                            return (
                                <Show when={perm} fallback={<div class="w-8" />}>
                                    <button
                                        onClick={() => perm && props.onPermissionToggle(perm.id)}
                                        class={`w-8 h-7 rounded-md text-xs font-medium transition-all duration-200 ${isSelected()
                                            ? 'bg-primary/20 text-primary ring-1 ring-primary/30'
                                            : 'bg-surface/50 text-muted hover:bg-surface hover:text-primary/60'
                                            }`}
                                        title={perm?.description || `${action.label} ${props.menu.label}`}
                                    >
                                        {action.shortLabel}
                                    </button>
                                </Show>
                            );
                        }}
                    </For>
                </div>
            </div>

            {/* Children */}
            <Show when={hasChildren() && isExpanded()}>
                <div class="children-container">
                    <For each={props.menu.children}>
                        {(child) => (
                            <TreeNode
                                menu={child}
                                depth={props.depth + 1}
                                permissionsByPrefix={props.permissionsByPrefix}
                                selectedIds={props.selectedIds}
                                expandedIds={props.expandedIds}
                                onToggleExpand={props.onToggleExpand}
                                onPermissionToggle={props.onPermissionToggle}
                                onModuleToggle={props.onModuleToggle}
                            />
                        )}
                    </For>
                </div>
            </Show>
        </div>
    );
};

// ============================================
// HELPER FUNCTIONS
// ============================================

function filterMenuTree(menus: MenuItemData[], search: string): MenuItemData[] {
    return menus
        .map(menu => {
            const matchesLabel = menu.label.toLowerCase().includes(search);
            const matchesKey = menu.key.toLowerCase().includes(search);
            const matchesPrefix = menu.permission_prefix?.toLowerCase().includes(search);

            // Recursively filter children
            const filteredChildren = menu.children
                ? filterMenuTree(menu.children, search)
                : [];

            // Include if matches OR has matching children
            if (matchesLabel || matchesKey || matchesPrefix || filteredChildren.length > 0) {
                return {
                    ...menu,
                    children: filteredChildren.length > 0 ? filteredChildren : menu.children,
                };
            }
            return null;
        })
        .filter((m): m is MenuItemData => m !== null);
}

export default MenuTreeView;
