
import { Component, For, Show, createMemo, createSignal, batch } from 'solid-js';
import { useNavigate, Outlet, useSearch } from '@tanstack/solid-router';
import { useQueryClient } from '@tanstack/solid-query';
import { toast } from 'solid-sonner';
import { copyToClipboard } from '@shared/utils/clipboard';
import type { Table, RowSelectionState, ColumnPinningState, VisibilityState, SortingState, Updater } from '@tanstack/solid-table';
import { isActiveLabels } from '../models/users.types';
// Data & hooks
import {
    useRoles, useUsers, useDeleteRole,
    useDeactivateUser, useRestoreUser,
    useBulkDeactivateUsers, useBulkRestoreUsers,
    useUserFacets
} from '../data/users.queries';
import { rbacKeys } from '../data/users.keys';
import { usersApi } from '../data/users.api';

import { type UserWithRoles, type Role, type UsersFilters, type UsersMeta } from '../models/users.types';



import { createUserColumns } from '../data/user.columns';
import { useDataTableSSE } from '@shared/hooks/useDataTableSSE';
import { useAuth } from '@modules/auth/store/auth.store';
import { useIsMobile } from '@shared/hooks/useIsMobile';
import { RealtimeEvents } from '@app/schema/realtime-events';

// Shared UI
import { DataTable } from '@shared/ui/DataTable';
import { PageHeader } from '@shared/ui/PageHeader';
import { SearchInput } from '@shared/ui/SearchInput';
import { Tabs, TabsList, TabsTrigger } from '@shared/ui/Tabs';
import { DropdownMenu } from '@shared/ui/DropdownMenu';
import { DataTableSelectionBar, SelectionBarAction, SelectionBarSeparator } from '@shared/ui/DataTable/DataTableSelectionBar';
import Button from '@shared/ui/Button';
import ConfirmDialog from '@shared/ui/ConfirmDialog';
import UserDeleteDialog from '../components/UserDeleteDialog';
import Switch from '@shared/ui/Switch';


// Feature components
import RoleCard from '../components/RoleCard';
import RoleFormDialog from '../components/RoleFormDialog';
import RoleUsersDialog from '../components/RoleUsersDialog';

// Icons
import {
    PlusIcon, TrashIcon, ColumnsIcon, UsersIcon, IdCardIcon,
    EyeIcon, EyeOffIcon, PinIcon, PinOffIcon, UserKeyIcon,
    RotateCcwIcon, ChevronsUpDownIcon, CopyIcon,
} from '@shared/ui/icons';

type TabKey = 'users' | 'roles';

// ─── Role dialog state ──────────────────────────────────────────────────────
interface RoleDialogState {
    mode: 'create' | 'edit' | 'permissions';
    roleId?: number;
}

const UsersRolesPage: Component = () => {
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const auth = useAuth();
    const isMobile = useIsMobile();

    // ─── Tab state (URL-synced via ?tab=) ───────────────────────
    const search = useSearch({ strict: false });
    const activeTab = (): TabKey => {
        const t = (search() as any)?.tab;
        return t === 'roles' ? 'roles' : 'users';
    };

    const handleTabChange = (tab: string) => {
        navigate({ search: ((prev: any) => ({ ...prev, tab, rolesSearch: undefined })) as any, replace: true });
    };

    // ─── Users tab state ────────────────────────────────────────
    const [userSearch, setUserSearch] = createSignal('');
    const [page, setPage] = createSignal(1);
    const [pageSize, setPageSize] = createSignal(10);
    const [sorting, setSorting] = createSignal<SortingState>([]);
    const [rowSelection, setRowSelection] = createSignal<RowSelectionState>({});
    const [columnVisibility, setColumnVisibility] = createSignal<VisibilityState>({});
    const [columnPinning, setColumnPinning] = createSignal<ColumnPinningState>({
        left: ['select'],
        right: ['actions'],
    });
    const [isActiveFilter, setIsActiveFilter] = createSignal<string[]>([]);
    const [rolesFilter, setRolesFilter] = createSignal<string[]>([]);

    const [tableInstance, setTableInstance] = createSignal<Table<UserWithRoles>>();

    // ─── Roles tab state ─────────────────────────────────────────
    const [rolesSearch, setRolesSearch] = createSignal(
        ((search() as any)?.rolesSearch as string) ?? ''
    );
    const [roleDialog, setRoleDialog] = createSignal<RoleDialogState | null>(null);
    const [usersDialog, setUsersDialog] = createSignal<{ roleId: number; roleName: string } | null>(null);

    // ─── Confirm dialogs ─────────────────────────────────────────
    const [deleteTarget, setDeleteTarget] = createSignal<UserWithRoles | null>(null);
    const [confirmDeleteRole, setConfirmDeleteRole] = createSignal<
        { id: number; name: string } | null
    >(null);
    const [showBulkDeleteConfirm, setShowBulkDeleteConfirm] = createSignal(false);
    const [showBulkRestoreConfirm, setShowBulkRestoreConfirm] = createSignal(false);

    // ─── Derived: filters for paginated users query ────────────
    const sortBy = () => sorting().length > 0 ? sorting()[0].id : undefined;
    const sortOrder = () =>
        sorting().length > 0 ? (sorting()[0].desc ? 'desc' as const : 'asc' as const) : undefined;

    const usersFilters = (): UsersFilters => ({
        search: userSearch() || undefined,
        page: page(),
        limit: pageSize(),
        sortBy: sortBy(),
        sortOrder: sortOrder(),
        isActive: isActiveFilter(),
        roles: rolesFilter(),
    });

    const columnFiltersMap = () => ({
        isActive: isActiveFilter(),
        roles: rolesFilter(),
    });

    // ─── Queries & Mutations ────────────────────────────────────
    const facetsQuery = useUserFacets(userSearch, columnFiltersMap);
    const usersQuery = useUsers(usersFilters);
    const rolesQuery = useRoles();
    const deactivateMutation = useDeactivateUser();
    const restoreMutation = useRestoreUser();
    const deleteRoleMutation = useDeleteRole();
    const bulkDeleteMutation = useBulkDeactivateUsers();
    const bulkRestoreMutation = useBulkRestoreUsers();

    // ─── SSE real-time invalidation ─────────────────────────────
    useDataTableSSE({
        room: 'users',
        queryKey: rbacKeys.lists(),
        events: [RealtimeEvents.USER.CREATED, RealtimeEvents.USER.UPDATED, RealtimeEvents.USER.DELETED],
    });

    // ─── Derived data ────────────────────────────────────────────
    const users = () => usersQuery.data?.data ?? [];
    const usersMeta = () => usersQuery.data?.meta;
    const totalUsers = () => usersMeta()?.total ?? 0;

    const roles = () => rolesQuery.data ?? [];
    const filteredRoles = createMemo(() => {
        const term = rolesSearch().toLowerCase();
        if (!term) return roles();
        return roles().filter(r =>
            r.name.toLowerCase().includes(term) ||
            r.description?.toLowerCase().includes(term)
        );
    });

    const selectedCount = () => Object.keys(rowSelection()).length;
    const selectedUsers = createMemo(() => {
        const selection = rowSelection();
        return users().filter((u: UserWithRoles) => selection[String(u.id)]);
    });
    const selectedActiveCount = () => selectedUsers().filter(u => u.isActive).length;
    const selectedInactiveCount = () => selectedUsers().filter(u => !u.isActive).length;

    // ─── Pagination handlers ─────────────────────────────────────
    const hasNextPage = () => usersMeta()?.hasNextPage ?? false;
    const hasPrevPage = () => usersMeta()?.hasPrevPage ?? false;

    const handleFirstPage = () => {
        batch(() => { setPage(1); setRowSelection({}); });
    };

    const handleLastPage = () => {
        batch(() => { setPage(usersMeta()?.pageCount ?? 1); setRowSelection({}); });
    };

    const handleNextPage = () => {
        batch(() => { setPage(p => p + 1); setRowSelection({}); });
    };

    const handlePrevPage = () => {
        batch(() => { setPage(p => Math.max(1, p - 1)); setRowSelection({}); });
    };

    const handlePageSizeChange = (size: number) => {
        batch(() => { setPageSize(size); setPage(1); });
    };

    const handleSearchInput = (value: string) => {
        batch(() => { setUserSearch(value); setPage(1); setRowSelection({}); });
    };

    const handleSortChange = (updater: Updater<SortingState>) => {
        batch(() => {
            setSorting(typeof updater === 'function' ? updater(sorting()) : updater);
            setPage(1);
        });
    };

    const handleFilterChange = (setter: (updater: (prev: string[]) => string[]) => void) => {
        return (values: string[]) => {
            batch(() => {
                setter(() => values);
                setPage(1);
            });
        };
    };

    // ─── Navigate handlers (Users only) ──────────────────────────
    const handleNewUser = () => navigate({ to: '/users/new' });
    const handleViewUser = (u: UserWithRoles) => navigate({ to: `/users/show/${u.id}` });
    const handleEditUser = (u: UserWithRoles) => navigate({ to: `/users/edit/${u.id}` });

    const handleRestore = (user: UserWithRoles) => {
        restoreMutation.mutate(user.id, {
            onSuccess: () => toast.success(`Se ha restaurado el usuario '${user.username}'`),
            onError: (err: any) => toast.error(err.message || 'Error al restaurar'),
        });
    };

    const handlePrefetchUser = (u: UserWithRoles) => {
        queryClient.prefetchQuery({
            queryKey: rbacKeys.user(u.id),
            queryFn: () => usersApi.getUser(u.id),
            staleTime: 1000 * 60 * 5,
        });
    };

    // ─── Role handlers (dialog-based) ────────────────────────────
    const handleNewRole = () => setRoleDialog({ mode: 'create' });
    const handleEditRole = (r: Role) => setRoleDialog({ mode: 'edit', roleId: r.id });
    const handleCloseRoleDialog = () => setRoleDialog(null);

    const handlePrefetchRole = (r: Role) => {
        queryClient.prefetchQuery({
            queryKey: rbacKeys.role(r.id),
            queryFn: () => usersApi.getRole(r.id),
            staleTime: 1000 * 60 * 5,
        });
        queryClient.prefetchQuery({
            queryKey: rbacKeys.rolePermissions(r.id),
            queryFn: () => usersApi.getRolePermissions(r.id),
            staleTime: 1000 * 60 * 5,
        });
    };

    // ─── Delete handlers ────────────────────────────────────────
    const handleDeleteUser = (u: UserWithRoles) =>
        setDeleteTarget(u);

    const handleDeleteRole = (r: Role) =>
        setConfirmDeleteRole({ id: r.id, name: r.name });

    const confirmDeleteRoleAction = () => {
        const target = confirmDeleteRole();
        if (!target) return;
        deleteRoleMutation.mutate(target.id, {
            onSuccess: () => toast.success(`Rol "${target.name}" eliminado`),
            onError: (err: any) => toast.error(err?.message || 'Error al eliminar'),
        });
        setConfirmDeleteRole(null);
    };

    // ─── Bulk actions ────────────────────────────────────────────
    const handleBulkDelete = () => setShowBulkDeleteConfirm(true);

    const confirmBulkDelete = () => {
        const ids = selectedUsers().filter(u => u.isActive).map(u => u.id);
        if (ids.length === 0) return;
        bulkDeleteMutation.mutate(ids, {
            onSuccess: () => {
                toast.success(`${ids.length} usuarios desactivados`);
                setRowSelection({});
                setShowBulkDeleteConfirm(false);
            },
            onError: (err: any) => toast.error(err.message || 'Error al eliminar'),
        });
    };

    const confirmBulkRestore = () => {
        const ids = selectedUsers().filter(u => !u.isActive).map(u => u.id);
        if (ids.length === 0) return;
        bulkRestoreMutation.mutate(ids, {
            onSuccess: () => {
                toast.success(`${ids.length} usuarios restaurados`);
                setRowSelection({});
                setShowBulkRestoreConfirm(false);
            },
            onError: (err: any) => toast.error(err.message || 'Error al restaurar'),
        });
    };

    const handleCopySelection = async () => {
        const selected = selectedUsers();
        if (selected.length === 0) return;
        const text = selected.map(u => {
            const parts = [
                `Usuario: ${u.username} (${u.email})`,
                u.roles.length > 0 ? `Roles: ${u.roles.map(r => r.name).join(', ')}` : null,
            ].filter(Boolean);
            return parts.join(' | ');
        }).join('\n');
        const ok = await copyToClipboard(text);
        if (ok) toast.success(`Copiado ${selected.length} usuarios al portapapeles`);
        else toast.error('Error al copiar al portapapeles');
        setRowSelection({});
    };

    // ─── Column visibility helpers ───────────────────────────────
    const configurableColumns = () => {
        const table = tableInstance();
        if (!table) return [];
        return table.getAllLeafColumns().filter(
            col => col.id !== 'select' && col.id !== 'actions' && (col.getCanHide() || col.getCanPin())
        );
    };

    const hasCustomPinnedColumns = () => {
        return tableInstance()?.getAllLeafColumns().some(
            col => col.getIsPinned() && col.id !== 'select' && col.id !== 'actions'
        ) ?? false;
    };

    // ─── Options mapping ─────────────────────────────────────────
    const buildFilterOptions = (
        facetKey: string,
        labelMap?: Record<string, string>
    ) => {
        const facets = facetsQuery.data;
        if (!facets || !facets[facetKey]) return [];
        return facets[facetKey].map(f => ({
            value: f.value,
            label: labelMap?.[f.value] ?? f.value,
            count: f.count,
        }));
    };

    const isActiveOptions = createMemo(() => buildFilterOptions('isActive', isActiveLabels));

    const rolesOptions = createMemo(() => {
        const facets = facetsQuery.data?.roles ?? [];
        const activeMap = new Map();

        for (const name of rolesFilter()) {
            activeMap.set(name, { label: name, value: name, count: 0 });
        }

        for (const f of facets) {
            activeMap.set(f.value, { label: f.value, value: f.value, count: f.count });
        }

        return Array.from(activeMap.values()).sort((a, b) => b.count - a.count);
    });

    // ─── Columns ────────────────────────────────────────────────
    const columns = createMemo(() =>
        createUserColumns({
            onView: handleViewUser,
            onEdit: handleEditUser,
            onDelete: handleDeleteUser,
            onRestore: handleRestore,
            onRoleBadgeClick: (role) => setRoleDialog({ mode: 'permissions', roleId: role.id }),
            auth,
            filters: {
                isActive: {
                    options: isActiveOptions,
                    selected: isActiveFilter,
                    onChange: handleFilterChange(setIsActiveFilter),
                    isLoading: () => facetsQuery.isPending,
                },
                roles: {
                    options: rolesOptions,
                    selected: rolesFilter,
                    onChange: handleFilterChange(setRolesFilter),
                    isLoading: () => facetsQuery.isPending,
                },
            }
        })
    );



    // ─── Render ──────────────────────────────────────────────────
    return (
        <div class="h-full flex flex-col bg-gradient-to-br from-background via-background to-surface/20">
            {/* Outlet: User Sheet panels mount here as overlay */}
            <Outlet />

            {/* Role FormDialog (inline, no routes) */}
            <RoleFormDialog
                mode={roleDialog()?.mode ?? 'create'}
                roleId={roleDialog()?.roleId}
                isOpen={roleDialog() !== null}
                onClose={handleCloseRoleDialog}
            />

            {/* Header */}
            <div class="flex-shrink-0 p-3 sm:p-4 space-y-4">
                <PageHeader
                    icon={<UserKeyIcon />}
                    iconBg="linear-gradient(135deg, #6366f1, #9477d6ff)"
                    title="Usuarios y Roles"
                    count={activeTab() === 'users' ? totalUsers() : roles().length}
                    info="Gestiona usuarios, roles y permisos de acceso al sistema."
                    actions={
                        <div class="flex items-center gap-3">
                            {/* Inline Tabs */}
                            <Tabs value={activeTab()} onChange={handleTabChange}>
                                <TabsList class="p-0.5" indicatorClass="inset-y-0.5">
                                    <TabsTrigger value="users">
                                        <UsersIcon class="size-4" />
                                        <span class="hidden @xl:inline">Usuarios</span>
                                    </TabsTrigger>
                                    <TabsTrigger value="roles">
                                        <UserKeyIcon class="size-4" />
                                        <span class="hidden @xl:inline">Roles</span>
                                    </TabsTrigger>
                                </TabsList>
                            </Tabs>

                            {/* CTA Button */}
                            <Show when={activeTab() === 'users' && auth.canAdd('users')}>
                                <Button
                                    onClick={handleNewUser}
                                    onMouseEnter={() => import('../components/UserNewSheet')}
                                    icon={<PlusIcon />}
                                >
                                    <span class="hidden @md:inline">Nuevo</span>
                                </Button>
                            </Show>
                            <Show when={activeTab() === 'roles' && auth.canAdd('roles')}>
                                <Button onClick={handleNewRole} icon={<PlusIcon />}>
                                    <span class="hidden @md:inline">Nuevo </span>
                                </Button>
                            </Show>
                        </div>
                    }
                />

                {/* Toolbar — Users */}
                <Show when={activeTab() === 'users'}>
                    <div class="flex flex-wrap items-center gap-2 sm:gap-3">
                        <SearchInput
                            value={userSearch()}
                            onSearch={handleSearchInput}
                            placeholder="Buscar usuarios..."
                            class="flex-1 min-w-[150px] max-w-md"
                        />

                        {/* Columns dropdown (desktop) */}
                            <DropdownMenu placement="bottom-end">
                                <DropdownMenu.Trigger class="h-9.5 px-4" variant="ghost">
                                    <ColumnsIcon />
                                    <span class="hidden sm:inline">Columnas</span>
                                </DropdownMenu.Trigger>
                                <DropdownMenu.Content class="min-w-[260px] p-2">
                                    <DropdownMenu.Label class="text-xs font-semibold text-muted tracking-wider mb-2">
                                        Visibilidad
                                    </DropdownMenu.Label>
                                    <div class="max-h-[320px] overflow-y-auto">
                                        <For each={configurableColumns()}>
                                            {(col) => {
                                                const isPinned = () => col.getIsPinned();
                                                const title = () => (col.columnDef.meta as { title?: string })?.title ?? col.id;
                                                return (
                                                    <div class="flex items-center gap-2 py-2 px-2 rounded-lg hover:bg-surface-2 transition-colors">
                                                        <span class="flex-1 text-sm text-text truncate">{title()}</span>


                                                        <Show when={col.getCanPin()}>
                                                            <div class="flex items-center gap-0.5 bg-surface rounded-md p-0.5">
                                                                <button
                                                                    onClick={() => col.pin(isPinned() === 'left' ? false : 'left')}
                                                                    class={`p-1 rounded transition-colors ${isPinned() === 'left'
                                                                        ? 'bg-primary text-white'
                                                                        : 'text-muted hover:text-text hover:bg-surface-2'
                                                                        }`}

                                                                    title={isPinned() === 'left' ? 'Desfijar' : 'Fijar izquierda'}
                                                                    aria-label={isPinned() === 'left' ? `Desfijar` : `Fijar columna a la izquierda`}
                                                                >
                                                                    <PinIcon class="size-3.5 rotate-45" />
                                                                </button>
                                                                <button
                                                                    onClick={() => col.pin(isPinned() === 'right' ? false : 'right')}
                                                                    class={`p-1 rounded transition-colors ${isPinned() === 'right'
                                                                        ? 'bg-primary text-white'
                                                                        : 'text-muted hover:text-text hover:bg-surface-2'
                                                                        }`}
                                                                    title={isPinned() === 'right' ? 'Desfijar' : 'Fijar derecha'}
                                                                    aria-label={isPinned() === 'right' ? `Desfijar` : `Fijar columna a la derecha`}
                                                                >
                                                                    <PinIcon class="size-3.5 -rotate-45" />
                                                                </button>
                                                            </div>
                                                        </Show>

                                                        <Show when={col.getCanHide()}>
                                                            <Switch
                                                                checked={col.getIsVisible()}
                                                                onChange={col.toggleVisibility}
                                                                aria-label={`Mostrar/ocultar ${title()}`}
                                                            />
                                                        </Show>
                                                    </div>
                                                );
                                            }}
                                        </For>
                                    </div>
                                    <DropdownMenu.Separator class="my-2" />
                                    <div class="flex flex-col gap-2 p-1">
                                        <div class="flex gap-2">
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                class="flex-1 text-xs h-8 px-2"
                                                onClick={() => tableInstance()?.getAllLeafColumns().forEach(col => col.getCanHide() && col.toggleVisibility(true))}
                                                icon={<EyeIcon class="size-3.5" />}
                                            >
                                                Mostrar todo
                                            </Button>
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                class="flex-1 text-xs h-8 px-2"
                                                onClick={() => tableInstance()?.getAllLeafColumns().forEach(col => col.getCanHide() && col.toggleVisibility(false))}
                                                icon={<EyeOffIcon class="size-3.5" />}
                                            >
                                                Ocultar todo
                                            </Button>
                                        </div>
                                        <Show when={hasCustomPinnedColumns()}>
                                            <Button
                                                variant="ghost" size="sm"
                                                class="text-xs h-8 text-muted"
                                                onClick={() => tableInstance()?.getAllLeafColumns().forEach(c => { if (c.id !== 'select' && c.id !== 'actions') c.pin(false); })}
                                                icon={<PinOffIcon class="size-3.5" />}
                                            >Desfijar</Button>
                                        </Show>
                                    </div>
                                </DropdownMenu.Content>
                            </DropdownMenu>
                    </div>
                </Show>

                {/* Toolbar — Roles */}
                <Show when={activeTab() === 'roles'}>
                    <SearchInput
                        value={rolesSearch()}
                        onSearch={(val) => {
                            setRolesSearch(val);
                            navigate({ search: ((prev: any) => ({ ...prev, rolesSearch: val || undefined })) as any, replace: true });
                        }}
                        placeholder="Buscar roles..."
                        class="max-w-md"
                    />
                </Show>
            </div>

            {/* Content */}
            <div class="flex-1 min-h-0 px-3 pb-3 sm:px-4 sm:pb-4 overflow-hidden">
                {/* Users tab — DataTable */}
                <Show when={activeTab() === 'users'}>
                    <div class="bg-card border border-border rounded-2xl shadow-card-soft h-full overflow-auto relative">
                        <DataTable
                            data={users()}
                            columns={columns()}
                            isLoading={usersQuery.isPending}
                            isPlaceholderData={usersQuery.isPlaceholderData}
                            // Pagination state (for display)
                            pagination={{ pageIndex: page() - 1, pageSize: pageSize() }}
                            onPaginationChange={() => { }}
                            pageCount={usersMeta()?.pageCount ?? 1}
                            totalRows={totalUsers()}
                            // Cursor Pagination handlers
                            cursorPagination={{
                                hasNextPage: hasNextPage(),
                                hasPrevPage: hasPrevPage(),
                                onNextPage: handleNextPage,
                                onPrevPage: handlePrevPage,
                                onFirstPage: handleFirstPage,
                                onLastPage: handleLastPage,
                                onPageSizeChange: handlePageSizeChange,
                            }}
                            sorting={sorting()}
                            onSortingChange={handleSortChange}
                            enableRowSelection={true}
                            rowSelection={rowSelection()}
                            onRowSelectionChange={setRowSelection}
                            getRowId={(row) => String(row.id)}
                            enableColumnPinning={true}
                            columnVisibility={columnVisibility()}
                            onColumnVisibilityChange={setColumnVisibility}
                            columnPinning={columnPinning()}
                            onColumnPinningChange={setColumnPinning}
                            onRowHover={handlePrefetchUser}
                            enableVirtualization={false}
                            estimatedRowHeight={56}
                            emptyIcon={<UsersIcon />}
                            emptyMessage="No hay usuarios"
                            emptyDescription="Crea uno nuevo para comenzar"
                            tableRef={(table) => setTableInstance(table)}
                        />
                    </div>
                </Show>

                {/* Roles tab — Card Grid */}
                <Show when={activeTab() === 'roles'}>
                        <Show
                            when={!rolesQuery.isPending}
                            fallback={
                                <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                                    <For each={Array(6)}>
                                        {() => (
                                            <div class="bg-card border border-border rounded-2xl p-5 h-36 animate-pulse" />
                                        )}
                                    </For>
                                </div>
                            }
                        >
                            <Show
                                when={filteredRoles().length > 0}
                                fallback={
                                    <div class="flex flex-col items-center justify-center py-20 text-center">
                                        <IdCardIcon class="size-10 opacity-20 mb-4" />
                                        <p class="text-muted">
                                            {rolesSearch() ? 'Sin resultados para la búsqueda' : 'No hay roles definidos'}
                                        </p>
                                    </div>
                                }
                            >
                                <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                                    <For each={filteredRoles()}>
                                        {(role) => (
                                            <RoleCard
                                                role={role}
                                                onEdit={() => handleEditRole(role)}
                                                onDelete={() => handleDeleteRole(role)}
                                                onUsersClick={() => setUsersDialog({ roleId: role.id, roleName: role.name })}
                                                onPermissionsClick={() => setRoleDialog({ mode: 'permissions', roleId: role.id })}
                                                onMouseEnter={() => handlePrefetchRole(role)}
                                            />
                                        )}
                                    </For>
                                </div>
                            </Show>
                        </Show>
                </Show>
            </div>

            {/* Bulk selection bar — mirrors SuppliersPage */}
            <DataTableSelectionBar
                selectedCount={selectedCount()}
                totalRows={totalUsers()}
                onClearSelection={() => setRowSelection({})}
            >
                <SelectionBarAction
                    icon={<CopyIcon class="size-4" />}
                    label="Copiar"
                    onClick={handleCopySelection}
                    iconOnMobile
                />
                <SelectionBarSeparator />
                <Show when={selectedActiveCount() > 0 && selectedInactiveCount() === 0}>
                    <SelectionBarAction
                        icon={<TrashIcon class="size-4" />}
                        label="Eliminar"
                        variant="danger"
                        onClick={handleBulkDelete}
                        loading={bulkDeleteMutation.isPending}
                        loadingText="Eliminando..."
                    />
                </Show>

                <Show when={selectedInactiveCount() > 0 && selectedActiveCount() === 0}>
                    <SelectionBarAction
                        icon={<RotateCcwIcon class="size-4" />}
                        label="Restaurar"
                        variant="success"
                        onClick={() => setShowBulkRestoreConfirm(true)}
                        loading={bulkRestoreMutation.isPending}
                        loadingText="Restaurando..."
                    />
                </Show>

                <Show when={selectedActiveCount() > 0 && selectedInactiveCount() > 0}>
                    <DropdownMenu placement="top-start">
                        <DropdownMenu.Trigger variant="ghost" size="sm" class="h-8 px-2.5 text-sm gap-1.5 focus-visible:ring-0">
                            <span>Acciones</span>
                            <ChevronsUpDownIcon class="size-3.5" />
                        </DropdownMenu.Trigger>
                        <DropdownMenu.Content class="min-w-[180px]">
                            <DropdownMenu.Item onSelect={handleBulkDelete} destructive>
                                <TrashIcon class="size-4 mr-2" />
                                <span class="flex-1 font-medium">Eliminar Activos</span>
                                <span class="bg-danger/20 text-danger font-bold text-xs px-1.5 py-0.5 rounded tabular-nums">{selectedActiveCount()}</span>
                            </DropdownMenu.Item>
                            <DropdownMenu.Item onSelect={() => setShowBulkRestoreConfirm(true)}>
                                <RotateCcwIcon class="size-4 mr-2 text-emerald-500" />
                                <span class="flex-1 text-emerald-500 font-medium">Restaurar Inactivos</span>
                                <span class="bg-emerald-500/20 text-emerald-500 font-bold text-xs px-1.5 py-0.5 rounded tabular-nums">{selectedInactiveCount()}</span>
                            </DropdownMenu.Item>
                        </DropdownMenu.Content>
                    </DropdownMenu>
                </Show>
            </DataTableSelectionBar>

            {/* User Delete Dialog — RBAC-aware: dual-mode for users.destroy */}
            <UserDeleteDialog
                user={deleteTarget()}
                onClose={() => setDeleteTarget(null)}
                onSuccess={() => toast.success('Usuario eliminado')}
            />

            {/* Bulk delete confirm */}
            <ConfirmDialog
                isOpen={showBulkDeleteConfirm()}
                onClose={() => setShowBulkDeleteConfirm(false)}
                onConfirm={confirmBulkDelete}
                title={`Desactivar ${selectedActiveCount()} usuarios`}
                description="Los usuarios seleccionados quedarán inactivos. Podrás restaurarlos en cualquier momento."
                confirmLabel="Desactivar"
                loadingText="Desactivando..."
                variant="danger"
                isLoading={bulkDeleteMutation.isPending}
            />

            {/* Bulk restore confirm */}
            <ConfirmDialog
                isOpen={showBulkRestoreConfirm()}
                onClose={() => setShowBulkRestoreConfirm(false)}
                onConfirm={confirmBulkRestore}
                title={`Restaurar ${selectedInactiveCount()} usuarios`}
                description="Los usuarios seleccionados volverán a estar activos con todos sus roles."
                confirmLabel="Restaurar"
                loadingText="Restaurando..."
                variant="success"
                isLoading={bulkRestoreMutation.isPending}
            />

            {/* Role delete confirm */}
            <ConfirmDialog
                isOpen={confirmDeleteRole() !== null}
                onClose={() => setConfirmDeleteRole(null)}
                onConfirm={confirmDeleteRoleAction}
                title={`Eliminar rol`}
                description={`¿Eliminar "${confirmDeleteRole()?.name}"? Esta acción no se puede deshacer.`}
                variant="danger"
            />



            {/* Role Users Dialog */}
            <RoleUsersDialog
                roleId={usersDialog()?.roleId ?? null}
                roleName={usersDialog()?.roleName ?? ''}
                isOpen={usersDialog() !== null}
                onClose={() => setUsersDialog(null)}
            />
        </div>
    );
};

export default UsersRolesPage;
