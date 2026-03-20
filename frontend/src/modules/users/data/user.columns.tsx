/**
 * User Column Definitions
 *
 * Extracted from UsersRolesPage for reusability and testability.
 * Creates column definitions with proper handlers.
 */
import { Show } from 'solid-js';
import { For } from 'solid-js';
import type { ColumnDef } from '@tanstack/solid-table';
import type { UserWithRoles } from '../models/users.types';
import { useAuth } from '@modules/auth/store/auth.store';
import { Avatar } from '@shared/ui/Avatar';
import { RoleBadge, StatusBadge } from '@shared/ui/Badge';
import Checkbox from '@shared/ui/Checkbox';
import { DataTableColumnHeader } from '@shared/ui/DataTable/DataTableColumnHeader';
import type { FilterOption } from '@shared/ui/DataTable/DataTableColumnFilter';
import { EditIcon, EyeIcon, TrashIcon, RotateCcwIcon, MoreVerticalIcon } from '@shared/ui/icons';
import DropdownMenu from '@shared/ui/DropdownMenu';

/** Filter configuration for a single column - uses accessors for SolidJS reactivity */
export interface ColumnFilterConfig {
    options: () => FilterOption[];
    selected: () => string[];
    onChange: (selected: string[]) => void;
    isLoading: () => boolean;
}

export interface UserColumnHandlers {
    onView: (user: UserWithRoles) => void;
    onEdit: (user: UserWithRoles) => void;
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
                <div
                    class="flex items-center gap-3 min-w-0 pl-2 cursor-pointer group/cell"
                    onClick={(e) => { e.stopPropagation(); handlers.onView(info.row.original); }}
                >
                    <Avatar name={info.row.original.username} size="sm" />
                    <div class="min-w-0">
                        <div class="font-medium text-text truncate group-hover/cell:text-primary transition-colors duration-150">{info.row.original.username}</div>
                        <div class="text-xs text-muted truncate">{info.row.original.email}</div>
                    </div>
                </div>
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
                                    class="cursor-pointer rounded-md transition-all hover:ring-2 hover:ring-primary/30 hover:scale-105 focus:outline-none focus:ring-2 focus:ring-primary/40"
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
                        {new Date(val).toLocaleDateString('es-EC', {
                            day: '2-digit', month: 'short', year: 'numeric'
                        })}
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
                const isActive = () => user.isActive;
                const canDestroy = () => handlers.auth.hasPermission('users.destroy');
                const canRestore = () => handlers.auth.hasPermission('users.restore') && !isActive();
                const canEdit = () => handlers.auth.canEdit('users');
                const canDelete = () => handlers.auth.canDelete('users') && isActive();
                return (
                    <div class="flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                        <DropdownMenu placement="bottom-end">
                            <DropdownMenu.Trigger variant="ghost" class="size-8 p-0 data-[expanded]:bg-card-alt data-[expanded]:opacity-100" title="Acciones">
                                <MoreVerticalIcon class="size-4" />
                            </DropdownMenu.Trigger>
                            <DropdownMenu.Content class="min-w-[160px]">
                                <DropdownMenu.Item onSelect={() => handlers.onView(user)}>
                                    <EyeIcon class="size-4 mr-2" />
                                    <span>Ver detalles</span>
                                </DropdownMenu.Item>
                                
                                <Show when={canEdit()}>
                                    <DropdownMenu.Item onSelect={() => handlers.onEdit(user)}>
                                        <EditIcon class="size-4 mr-2" />
                                        <span>Editar</span>
                                    </DropdownMenu.Item>
                                </Show>

                                <Show when={canRestore()}>
                                    <DropdownMenu.Item onSelect={() => handlers.onRestore(user)}>
                                        <RotateCcwIcon class="size-4 mr-2 text-emerald-500" />
                                        <span class="text-emerald-500">Restaurar</span>
                                    </DropdownMenu.Item>
                                </Show>

                                <Show when={canDelete() || canDestroy()}>
                                    <DropdownMenu.Separator />
                                    <DropdownMenu.Item onSelect={() => handlers.onDelete(user)} destructive>
                                        <TrashIcon class="size-4 mr-2" />
                                        <span>Eliminar</span>
                                    </DropdownMenu.Item>
                                </Show>
                            </DropdownMenu.Content>
                        </DropdownMenu>
                    </div>
                );
            },
        },
    ];
}
