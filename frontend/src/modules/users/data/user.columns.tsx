/**
 * User Column Definitions
 *
 * Extracted from UsersRolesPage for reusability and testability.
 * Creates column definitions with proper handlers.
 */
import { Show, For } from 'solid-js';
import { Link } from '@tanstack/solid-router';
import type { ColumnDef } from '@tanstack/solid-table';
import type { UserWithRoles } from '../models/users.types';
import { useAuth } from '@modules/auth/store/auth.store';
import { Avatar } from '@shared/ui/Avatar';
import { RoleBadge, StatusBadge, EntityTypeBadge } from '@shared/ui/Badge';
import { formatSessionDate } from '@shared/utils/session.utils';
import Checkbox from '@shared/ui/Checkbox';
import { DataTableColumnHeader } from '@shared/ui/DataTable/DataTableColumnHeader';
import type { FilterOption } from '@shared/ui/DataTable/DataTableColumnFilter';
import ActionMenu from '@shared/ui/ActionMenu';

/** Filter configuration for a single column - uses accessors for SolidJS reactivity */
export interface ColumnFilterConfig {
    options: () => FilterOption[];
    selected: () => string[];
    onChange: (selected: string[]) => void;
    isLoading: () => boolean;
}

export interface UserColumnHandlers {
    onDelete: (user: UserWithRoles) => void;
    onRestore: (user: UserWithRoles) => void;
    onRoleBadgeClick?: (role: { id: number; name: string }) => void;
    auth: ReturnType<typeof useAuth>;
    filters?: {
        username?: ColumnFilterConfig;
        isActive?: ColumnFilterConfig;
        roles?: ColumnFilterConfig;
        lastLogin?: ColumnFilterConfig;
    };
}

export function createUserColumns(handlers: UserColumnHandlers): ColumnDef<UserWithRoles>[] {
    return [
        // -------------------------------------------------------------------
        // Select checkbox (pinned left)
        // -------------------------------------------------------------------
        {
            id: 'select',
            size: 36,
            enableSorting: false,
            enableHiding: false,
            header: ({ table }) => (
                <Checkbox
                    indeterminate={table.getIsSomePageRowsSelected() && !table.getIsAllPageRowsSelected()}
                    checked={table.getIsAllPageRowsSelected()}
                    onChange={(checked) => table.toggleAllPageRowsSelected(checked)} />
            ),
            cell: ({ row }) => (
                <div onClick={(e) => e.stopPropagation()}>
                    <Checkbox
                        checked={row.getIsSelected()}
                        onChange={(checked) => row.toggleSelected(checked)}
                    />
                </div>
            ),

        },

        // -------------------------------------------------------------------
        // Avatar + usuario + email
        // -------------------------------------------------------------------
        {
            id: 'username',
            accessorKey: 'username',
            enableSorting: true,
            meta: { title: 'Usuario' },
            header: ({ column }) => (
                <DataTableColumnHeader
                    column={column}
                    title="Usuario"
                    filterOptions={handlers.filters?.username?.options()}
                    selectedFilters={handlers.filters?.username?.selected()}
                    onFilterChange={handlers.filters?.username?.onChange}
                    isFilterLoading={handlers.filters?.username?.isLoading()}
                />
            ),
            cell: (info) => (
                <Link
                    to={`/users/${info.row.original.id}/show`}
                    preload="intent"
                    class="flex items-center gap-3 min-w-0 pl-2 cursor-pointer group/cell"
                    onClick={(e) => e.stopPropagation()}
                >
                    <Avatar name={info.row.original.username} size="sm" />
                    <div class="min-w-0">
                        <div class="font-medium text-text truncate group-hover/cell:text-primary transition-colors duration-150">{info.row.original.username}</div>
                        <div class="text-xs text-muted truncate">{info.row.original.email}</div>
                    </div>
                </Link>
            ),
        },

        // -------------------------------------------------------------------
        // Roles
        // -------------------------------------------------------------------
        {
            accessorKey: 'roles',
            meta: { title: 'Roles' },
            header: ({ column }) => (
                <DataTableColumnHeader
                    column={column}
                    title="Roles"
                    filterOptions={handlers.filters?.roles?.options()}
                    selectedFilters={handlers.filters?.roles?.selected()}
                    onFilterChange={handlers.filters?.roles?.onChange}
                    isFilterLoading={handlers.filters?.roles?.isLoading()}
                />
            ),
            cell: (info) => (
                <div class="flex flex-wrap gap-1">
                    <Show
                        when={info.row.original.roles.length > 0}
                        fallback={<span class="text-muted text-xs">Sin roles</span>}
                    >
                        <For each={info.row.original.roles}>
                            {(role) => (
                                <button
                                    type="button"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        handlers.onRoleBadgeClick?.(role);
                                    }}
                                    class="cursor-pointer rounded-md hover:opacity focus:outline-none focus:ring-2 focus:ring-primary/40"
                                    title={`Ver permisos de ${role.name}`}
                                >
                                    <RoleBadge name={role.name} />
                                </button>
                            )}
                        </For>
                    </Show>
                </div>
            ),
        },

        // -------------------------------------------------------------------
        // Entidad vinculada
        // -------------------------------------------------------------------
        {
            id: 'entity',
            accessorFn: (row) => row.entityName,
            enableSorting: false,
            meta: { title: 'Entidad' },
            header: ({ column }) => (
                <DataTableColumnHeader
                    column={column}
                    title="Entidad"
                />
            ),
            cell: (info) => {
                const user = info.row.original;
                const name = user.entityName;
                if (!name) {
                    return <span class="text-muted text-sm italic">Sin entidad</span>;
                }
                const isSupplier = user.entityIsSupplier;
                // Currently deeply nested modaling is only fully implemented for Suppliers.
                // Clients and Employees will link here once their respective route factories exist.
                const hasModal = isSupplier && user.entityId;

                return (
                    <div class="flex flex-col gap-0.5 min-w-0">
                        <Show when={hasModal}
                            fallback={<span class="text-sm text-text truncate font-medium" title={name}>{name}</span>}
                        >
                            <Link
                                to={`/users/supplier/${user.entityId}/show`}
                                preload="intent"
                                class="text-sm text-text hover:text-primary hover:underline truncate font-medium"
                                title={`Ver detalles de ${name}`}
                                onClick={(e) => e.stopPropagation()}
                            >
                                {name}
                            </Link>
                        </Show>
                        <Show when={user.entityTaxId}>
                            <span class="text-[11px] text-muted/70 font-mono truncate">{user.entityTaxId}</span>
                        </Show>
                        <div class="flex gap-1 mt-0.5">
                            <Show when={user.entityIsClient}>
                                <EntityTypeBadge type="client" />
                            </Show>
                            <Show when={user.entityIsSupplier}>
                                <EntityTypeBadge type="supplier" />
                            </Show>
                            <Show when={user.entityIsEmployee}>
                                <EntityTypeBadge type="employee" />
                            </Show>
                        </div>
                    </div>
                );
            },
        },

        // -------------------------------------------------------------------
        // Estado
        // -------------------------------------------------------------------
        {
            accessorKey: 'isActive',
            enableSorting: true,
            meta: { title: 'Estado' },
            size: 120,
            header: ({ column }) => (
                <DataTableColumnHeader
                    column={column}
                    title="Estado"
                    filterOptions={handlers.filters?.isActive?.options()}
                    selectedFilters={handlers.filters?.isActive?.selected()}
                    onFilterChange={handlers.filters?.isActive?.onChange}
                    isFilterLoading={handlers.filters?.isActive?.isLoading()}
                />
            ),
            cell: (info) => <StatusBadge isActive={info.getValue<boolean | null>()} />,
        },

        // -------------------------------------------------------------------
        // Último acceso
        // -------------------------------------------------------------------
        {
            id: 'lastLogin',
            accessorKey: 'lastLogin',
            enableSorting: true,
            meta: { title: 'Último acceso' },
            size: 160,
            header: ({ column }) => (
                <DataTableColumnHeader
                    column={column}
                    title="Último acceso"
                />
            ),
            cell: (info) => {
                const val = info.getValue<string | null>();
                if (!val) return <span class="text-muted text-xs">Nunca</span>;
                return (
                    <span class="text-sm text-muted">
                        {formatSessionDate(val)}
                    </span>
                );
            },
        },

        // -------------------------------------------------------------------
        // Actions — dropdown adapts based on is_active state & permissions
        // -------------------------------------------------------------------
        {
            id: 'actions',
            header: '',
            size: 50,
            enableHiding: false,
            cell: (info) => {
                const user = info.row.original;
                return (
                    <ActionMenu
                        module="users"
                        isActive={user.isActive ?? false}
                        showTo={`/users/${user.id}/show`}
                        editTo={`/users/${user.id}/edit`}
                        onRestore={() => handlers.onRestore(user)}
                        onDelete={() => handlers.onDelete(user)}
                    />
                );
            },
        },
    ];
}
