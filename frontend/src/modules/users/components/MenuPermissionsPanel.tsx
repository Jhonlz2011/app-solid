import { Component, createSignal, createEffect, createMemo, Show } from 'solid-js';
import { Portal } from 'solid-js/web';
import { createQuery } from '@tanstack/solid-query';
import { MenuTreeView } from './MenuTreeView';
import { SearchInput } from '@shared/ui/SearchInput';
import { SkeletonLoader } from '@shared/ui/SkeletonLoader';
import { api } from '@shared/lib/eden';

interface Permission {
    id: number;
    slug: string;
    description?: string;
}

interface MenuItem {
    id: number;
    key: string;
    label: string;
    icon?: string;
    path?: string;
    parent_id: number | null;
    sort_order: number;
    permission_prefix?: string;
}

interface Role {
    id: number;
    name: string;
    description?: string;
}

interface MenuPermissionsPanelProps {
    role: Role;
    currentPermissionIds: number[];
    allPermissions: Permission[];
    onClose: () => void;
    onSave: (permissionIds: number[]) => void;
    isPending: boolean;
}

/**
 * MenuPermissionsPanel - Modal for assigning permissions to a role
 * Uses the new MenuTreeView to display permissions organized by menu
 */
export const MenuPermissionsPanel: Component<MenuPermissionsPanelProps> = (props) => {
    const [selectedIds, setSelectedIds] = createSignal<Set<number>>(new Set(props.currentPermissionIds));
    const [search, setSearch] = createSignal('');

    // Fetch menu items from admin endpoint
    const menusQuery = createQuery(() => ({
        queryKey: ['admin', 'menus'],
        queryFn: async () => {
            const { data, error } = await api.api.modules.admin.items.get();
            if (error) throw new Error(String(error.value));
            return buildMenuTree(data!);
        },
        staleTime: 1000 * 60 * 5, // 5 minutes
    }));

    // Reset selection when role changes
    createEffect(() => {
        setSelectedIds(new Set(props.currentPermissionIds));
    });

    // Count selected permissions
    const selectedCount = createMemo(() => selectedIds().size);
    const totalCount = () => props.allPermissions.length;

    // Permission toggle handler
    const handlePermissionToggle = (permissionId: number) => {
        const newSet = new Set(selectedIds());
        if (newSet.has(permissionId)) {
            newSet.delete(permissionId);
        } else {
            newSet.add(permissionId);
        }
        setSelectedIds(newSet);
    };

    // Module toggle handler (select/deselect all permissions for a module)
    const handleModuleToggle = (prefix: string, selected: boolean) => {
        const newSet = new Set(selectedIds());
        const modulePerms = props.allPermissions.filter(p => p.slug.startsWith(prefix + '.'));

        for (const perm of modulePerms) {
            if (selected) {
                newSet.add(perm.id);
            } else {
                newSet.delete(perm.id);
            }
        }
        setSelectedIds(newSet);
    };

    // Select/deselect all
    const toggleAll = () => {
        if (selectedIds().size === props.allPermissions.length) {
            setSelectedIds(new Set());
        } else {
            setSelectedIds(new Set(props.allPermissions.map(p => p.id)));
        }
    };

    const handleSave = () => {
        props.onSave(Array.from(selectedIds()));
    };

    return (
        <Portal>
            <div class="fixed inset-0 z-50 flex items-center justify-center p-4">
                {/* Backdrop */}
                <div class="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={props.onClose} />

                {/* Modal */}
                <div class="relative bg-card border border-border shadow-card-soft rounded-2xl w-full max-w-4xl max-h-[85vh] flex flex-col animate-in fade-in zoom-in-95 duration-200">
                    {/* Header */}
                    <div class="flex-shrink-0 p-6 pb-4 border-b border-border">
                        <div class="flex items-center justify-between mb-4">
                            <div>
                                <h2 class="text-xl font-bold">
                                    Permisos para:{' '}
                                    <span class="text-primary">{props.role.name}</span>
                                </h2>
                                <p class="text-sm text-muted mt-1">
                                    {selectedCount()} de {totalCount()} permisos seleccionados
                                </p>
                            </div>
                            <button
                                onClick={toggleAll}
                                class="text-sm px-3 py-1.5 rounded-lg bg-surface hover:bg-surface/80 text-muted transition-colors"
                            >
                                {selectedIds().size === props.allPermissions.length ? 'Quitar todos' : 'Seleccionar todos'}
                            </button>
                        </div>

                        {/* Search */}
                        <SearchInput
                            value={search()}
                            onSearch={setSearch}
                            placeholder="Buscar menús o permisos..."
                            class="w-full"
                        />
                    </div>

                    {/* Content */}
                    <div class="flex-1 overflow-y-auto p-6">
                        <Show when={!menusQuery.isLoading} fallback={<SkeletonLoader type="card" count={5} />}>
                            <Show when={menusQuery.data}>
                                <MenuTreeView
                                    menus={menusQuery.data!}
                                    allPermissions={props.allPermissions}
                                    selectedPermissionIds={selectedIds()}
                                    onPermissionToggle={handlePermissionToggle}
                                    onModuleToggle={handleModuleToggle}
                                    search={search()}
                                />
                            </Show>
                        </Show>
                    </div>

                    {/* Footer */}
                    <div class="flex-shrink-0 p-6 pt-4 border-t border-border flex items-center justify-end gap-3">
                        <button
                            onClick={props.onClose}
                            class="btn btn-ghost"
                            disabled={props.isPending}
                        >
                            Cancelar
                        </button>
                        <button
                            onClick={handleSave}
                            class="btn btn-primary"
                            disabled={props.isPending}
                        >
                            {props.isPending ? 'Guardando...' : 'Guardar Permisos'}
                        </button>
                    </div>
                </div>
            </div>
        </Portal>
    );
};

// ============================================
// HELPER FUNCTIONS
// ============================================

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

function buildMenuTree(items: MenuItem[]): MenuItemData[] {
    const map = new Map<number, MenuItemData>();

    // First pass: create all nodes
    for (const item of items) {
        map.set(item.id, {
            ...item,
            children: [],
        });
    }

    // Second pass: build tree
    const roots: MenuItemData[] = [];
    for (const item of items) {
        const node = map.get(item.id)!;
        if (item.parent_id === null) {
            roots.push(node);
        } else {
            const parent = map.get(item.parent_id);
            if (parent) {
                parent.children = parent.children || [];
                parent.children.push(node);
            }
        }
    }

    // Sort by sort_order
    const sortChildren = (nodes: MenuItemData[]) => {
        nodes.sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
        for (const node of nodes) {
            if (node.children && node.children.length > 0) {
                sortChildren(node.children);
            }
        }
    };
    sortChildren(roots);

    return roots;
}

export default MenuPermissionsPanel;
