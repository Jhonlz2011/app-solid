/**
 * User Column Definitions
 *
 * Extracted from UsersRolesPage for reusability and testability.
 * Creates column definitions with proper handlers.
 */
import { Show, For } from 'solid-js';
import { Link } from '@tanstack/solid-router';
import type { ColumnDef } from '@tanstack/solid-table';
export type { UserListItemType } from '@app/schema/backend';
import { useAuth } from '@modules/auth/store/auth.store';
import { Avatar } from '@shared/ui/display/Avatar';
import { RoleBadge, StatusBadge, EntityTypeBadge } from '@display/Badge';
import { formatSessionDate } from '@shared/utils/session.utils';
import Checkbox from '@form/Checkbox';
import { DataTableColumnHeader } from '@shared/ui/DataTable/DataTableColumnHeader';
import type { FilterOption } from '@shared/ui/DataTable/DataTableColumnFilter';
import ActionMenu from '@shared/ui/overlay/ActionMenu';

/** Filter configuration for a single column - uses accessors for SolidJS reactivity */
export interface ColumnFilterConfig {
    options: () => FilterOption[];
    selected: () => string[];
    onChange: (selected: string[]) => void;
    isLoading: () => boolean;
}

export interface UserColumnHandlers {
    onDelete: (user: UserListItemType) => void;
    onRestore: (user: UserListItemType) => void;
    onRoleBadgeClick?: (role: { id: number; name: string }) => void;
    auth: ReturnType<typeof useAuth>;
    filters?: {
        username?: ColumnFilterConfig;
        isActive?: ColumnFilterConfig;
        roles?: ColumnFilterConfig;
        lastLogin?: ColumnFilterConfig;
    };
}

export function createUserColumns(handlers: UserColumnHandlers): ColumnDef<UserListItemType>[] {
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
            cell: ({ row }) => {
                const isSuperadmin = row.original.roles?.some(r => r.name === 'superadmin') ?? false;
                if (isSuperadmin) {
                    return (
                        <div
                            class="size-4 flex items-center justify-center opacity-30 cursor-not-allowed"
                            title="El propietario de la empresa no puede ser seleccionado para acciones en lote"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <Checkbox checked={false} disabled />
                        </div>
                    );
                }
                return (
                    <div onClick={(e) => e.stopPropagation()}>
                        <Checkbox
                            checked={row.getIsSelected()}
                            onChange={(checked) => row.toggleSelected(checked)}
                        />
                    </div>
                );
            },

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
                                <Link
                                    to={`/users/role/${role.id}/permissions`}
                                    preload="intent"
                                    class="cursor-pointer rounded-md hover:opacity-85 focus:outline-none focus:ring-2 focus:ring-primary/40 inline-block"
                                    title={`Ver permisos de ${role.name}`}
                                    onClick={(e) => e.stopPropagation()}
                                >
                                    <RoleBadge name={role.name} />
                                </Link>
                            )}
                        </For>
                    </Show>
                </div>
            ),
        },

        // -------------------------------------------------------------------
        // Persona asociada (Entity)
        // -------------------------------------------------------------------
        {
            id: 'entity',
            accessorFn: (row) => row.entity?.businessName,
            enableSorting: false,
            meta: { title: 'Persona' },
            header: ({ column }) => (
                <DataTableColumnHeader
                    column={column}
                    title="Persona"
                />
            ),
            cell: (info) => {
                const user = info.row.original;
                const entity = user.entity;
                const name = entity?.businessName;
                if (!entity || !name) {
                    return <span class="text-muted text-sm italic">Sin persona</span>;
                }

                const entityPath = () => {
                    if (!user.entityId) return null;
                    if (entity.isEmployee) return `/users/employee/${user.entityId}/show`;
                    if (entity.isClient) return `/users/client/${user.entityId}/show`;
                    if (entity.isSupplier) return `/users/supplier/${user.entityId}/show`;
                    return null;
                };

                return (
                    <div class="flex flex-col gap-0.5 min-w-0">
                        <Show when={entityPath()}
                            fallback={<span class="text-sm text-text truncate font-medium" title={name}>{name}</span>}
                        >
                            {(path) => (
                                <Link
                                    to={path()}
                                    preload="intent"
                                    class="text-sm text-text hover:text-primary hover:underline truncate font-medium"
                                    title={`Ver detalles de ${name}`}
                                    onClick={(e) => e.stopPropagation()}
                                >
                                    {name}
                                </Link>
                            )}
                        </Show>
                        <Show when={entity.taxId}>
                            <span class="text-[11px] text-muted/70 font-mono truncate">{entity.taxId}</span>
                        </Show>
                        <div class="flex gap-1 mt-0.5">
                            <Show when={entity.isClient}>
                                <EntityTypeBadge type="client" />
                            </Show>
                            <Show when={entity.isSupplier}>
                                <EntityTypeBadge type="supplier" />
                            </Show>
                            <Show when={entity.isEmployee}>
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
                const isSuperadmin = user.roles?.some(r => r.name === 'superadmin') ?? false;
                return (
                    <ActionMenu
                        module="users"
                        isActive={user.isActive ?? false}
                        showTo={`/users/${user.id}/show`}
                        editTo={`/users/${user.id}/edit`}
                        onRestore={isSuperadmin ? undefined : () => handlers.onRestore(user)}
                        onDelete={isSuperadmin ? undefined : () => handlers.onDelete(user)}
                    />
                );
            },
        },
    ];
}
