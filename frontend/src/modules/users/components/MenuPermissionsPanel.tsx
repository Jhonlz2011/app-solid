import { Component, createSignal, createEffect, on, createMemo, Show } from 'solid-js';
import { createQuery } from '@tanstack/solid-query';
import { MenuTreeView } from './MenuTreeView';
import { FormDialog } from '@shared/ui/FormDialog';
import { SearchInput } from '@shared/ui/SearchInput';
import { SkeletonLoader } from '@shared/ui/SkeletonLoader';
import Button from '@shared/ui/Button';
import { api } from '@shared/lib/eden';
import type { Role } from '../models/users.types';

// ============================================
// TYPES
// ============================================

// Permission type — matches backend response where description can be null
interface PermissionItem {
    id: number;
    slug: string;
    description: string | null;
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

interface MenuPermissionsPanelProps {
    role: Role;
    currentPermissionIds: number[];
    allPermissions: PermissionItem[];
    onClose: () => void;
    onSave: (permissionIds: number[]) => void;
    isPending: boolean;
}

/**
 * MenuPermissionsPanel - FormDialog for assigning permissions to a role.
 * Uses MenuTreeView to display permissions organized by menu hierarchy.
 */
export const MenuPermissionsPanel: Component<MenuPermissionsPanelProps> = (props) => {
    const [selectedIds, setSelectedIds] = createSignal<Set<number>>(new Set(props.currentPermissionIds));
    const [search, setSearch] = createSignal('');

    // Fetch menu items from admin endpoint
    const menusQuery = createQuery(() => ({
        queryKey: ['admin', 'menus'],
        queryFn: async () => {
            const { data, error } = await api.api.modules.items.get();
            if (error) throw new Error(String(error.value));
            return buildMenuTree(data as unknown as MenuItem[]);
        },
        staleTime: 1000 * 60 * 5,
    }));

    // Reset selection when role changes — explicit dependency with on() guard
    createEffect(on(
        () => props.currentPermissionIds,
        (ids) => setSelectedIds(new Set(ids))
    ));

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
            setSelectedIds(new Set<number>());
        } else {
            setSelectedIds(new Set<number>(props.allPermissions.map(p => p.id)));
        }
    };

    const handleSubmit = (e: Event) => {
        e.preventDefault();
        props.onSave(Array.from(selectedIds()));
    };

    return (
        <FormDialog
            isOpen={true}
            onClose={props.onClose}
            title={`Permisos para: ${props.role.name}`}
            onSubmit={handleSubmit}
            submitLabel={props.isPending ? 'Guardando...' : 'Guardar Permisos'}
            isLoading={props.isPending}
            maxWidth="4xl"
        >
            {/* Toolbar */}
            <div class="flex items-center justify-between gap-3">
                <p class="text-sm text-muted">
                    {selectedCount()} de {totalCount()} permisos seleccionados
                </p>
                <Button
                    variant="ghost"
                    size="sm"
                    onClick={toggleAll}
                >
                    {selectedIds().size === props.allPermissions.length ? 'Quitar todos' : 'Seleccionar todos'}
                </Button>
            </div>

            {/* Search */}
            <SearchInput
                value={search()}
                onSearch={setSearch}
                placeholder="Buscar menús o permisos..."
                class="w-full"
            />

            {/* Content */}
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
        </FormDialog>
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
