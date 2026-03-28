/**
 * useUsersState — All state, queries, mutations, and handlers for UsersRolesPage.
 *
 * Extracts ~300 lines of logic from the God Component so the page only renders.
 */
import { createSignal, createMemo, batch } from 'solid-js';
import type { RowSelectionState, ColumnPinningState, VisibilityState, SortingState, Updater, Table } from '@tanstack/solid-table';
import { useQueryClient } from '@tanstack/solid-query';
import { useNavigate, useSearch } from '@tanstack/solid-router';
import { toast } from 'solid-sonner';
import { copyToClipboard } from '@shared/utils/clipboard';
import { buildFilterOptions } from '@shared/utils/facets.utils';
import { isActiveLabels } from '@shared/constants/labels';
import { useDataTableSSE } from '@shared/hooks/useDataTableSSE';
import { useAuth } from '@modules/auth/store/auth.store';
import { RealtimeEvents } from '@app/schema/realtime-events';
import type { PanelSearch } from '@shared/types/search-params.types';

import {
    useRoles, useUsers, useDeleteRole,
    useDeactivateUser, useRestoreUser,
    useBulkDeactivateUsers, useBulkRestoreUsers,
    useUserFacets,
} from '../data/users.queries';
import { rbacKeys } from '../data/users.keys';
import { usersApi } from '../data/users.api';
import { type UserWithRoles, type Role, type UsersFilters } from '../models/users.types';
import { createUserColumns } from '../data/user.columns';

// ─── Types ──────────────────────────────────────────────────────
export type TabKey = 'users' | 'roles';

export interface RoleDialogState {
    mode: 'create' | 'edit' | 'permissions';
    roleId?: number;
}

export function useUsersState() {
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const auth = useAuth();
    const search = useSearch({ strict: false });

    // ─── Tab state (URL-synced) ─────────────────────────────────
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

    // ─── Roles tab state ────────────────────────────────────────
    const [rolesSearch, setRolesSearch] = createSignal(
        ((search() as any)?.rolesSearch as string) ?? ''
    );
    const [roleDialog, setRoleDialog] = createSignal<RoleDialogState | null>(null);
    const [usersDialog, setUsersDialog] = createSignal<{ roleId: number; roleName: string } | null>(null);

    // ─── Confirm dialogs ────────────────────────────────────────
    const [deleteTarget, setDeleteTarget] = createSignal<UserWithRoles | null>(null);
    const [confirmDeleteRole, setConfirmDeleteRole] = createSignal<{ id: number; name: string } | null>(null);
    const [showBulkDeleteConfirm, setShowBulkDeleteConfirm] = createSignal(false);
    const [showBulkRestoreConfirm, setShowBulkRestoreConfirm] = createSignal(false);

    // ─── Derived: filters ───────────────────────────────────────
    const sortBy = () => sorting().length > 0 ? sorting()[0].id : undefined;
    const sortOrder = () => sorting().length > 0 ? (sorting()[0].desc ? 'desc' as const : 'asc' as const) : undefined;

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

    // ─── SSE ────────────────────────────────────────────────────
    useDataTableSSE({
        room: 'users',
        queryKey: rbacKeys.lists(),
        events: [RealtimeEvents.USER.CREATED, RealtimeEvents.USER.UPDATED, RealtimeEvents.USER.DELETED],
    });

    // ─── Derived data ───────────────────────────────────────────
    const users = () => usersQuery.data?.data ?? [];
    const usersMeta = () => usersQuery.data?.meta;
    const totalUsers = () => usersMeta()?.total ?? 0;

    const roles = () => rolesQuery.data ?? [];
    const filteredRoles = createMemo(() => {
        const term = rolesSearch().toLowerCase();
        if (!term) return roles();
        return roles().filter(r =>
            r.name.toLowerCase().includes(term) || r.description?.toLowerCase().includes(term)
        );
    });

    const selectedCount = () => Object.keys(rowSelection()).length;
    const selectedUsers = createMemo(() => {
        const selection = rowSelection();
        return users().filter((u: UserWithRoles) => selection[String(u.id)]);
    });
    const selectedActiveCount = () => selectedUsers().filter(u => u.isActive).length;
    const selectedInactiveCount = () => selectedUsers().filter(u => !u.isActive).length;

    // ─── Pagination handlers ────────────────────────────────────
    const hasNextPage = () => usersMeta()?.hasNextPage ?? false;
    const hasPrevPage = () => usersMeta()?.hasPrevPage ?? false;

    const handleFirstPage = () => batch(() => { setPage(1); setRowSelection({}); });
    const handleLastPage = () => batch(() => { setPage(usersMeta()?.pageCount ?? 1); setRowSelection({}); });
    const handleNextPage = () => batch(() => { setPage(p => p + 1); setRowSelection({}); });
    const handlePrevPage = () => batch(() => { setPage(p => Math.max(1, p - 1)); setRowSelection({}); });
    const handlePageSizeChange = (size: number) => batch(() => { setPageSize(size); setPage(1); });

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
            batch(() => { setter(() => values); setPage(1); });
        };
    };

    // ─── Navigation handlers ────────────────────────────────────
    const panelSearch = (): PanelSearch => (search() as PanelSearch) ?? {};
    const handleNewUser = () => navigate({ to: '.', search: (prev: any) => ({ ...prev, panel: 'new', id: undefined }) } as any);
    const handleViewUser = (u: UserWithRoles) => navigate({ to: '.', search: (prev: any) => ({ ...prev, panel: 'show', id: u.id }) } as any);
    const handleEditUser = (u: UserWithRoles) => navigate({ to: '.', search: (prev: any) => ({ ...prev, panel: 'edit', id: u.id }) } as any);
    const handleClosePanel = () => navigate({ to: '.', search: (prev: any) => ({ ...prev, panel: undefined, id: undefined, from: undefined }) } as any);
    const handleCloseModal = () => navigate({ to: '.', search: (prev: any) => ({ ...prev, modal: undefined, modalId: undefined, fromModal: undefined }) } as any);

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

    // ─── Role handlers ──────────────────────────────────────────
    const handleNewRole = () => setRoleDialog({ mode: 'create' });
    const handleEditRole = (r: Role) => setRoleDialog({ mode: 'edit', roleId: r.id });
    const handleCloseRoleDialog = () => setRoleDialog(null);

    const handlePrefetchRole = (r: Role) => {
        queryClient.prefetchQuery({ queryKey: rbacKeys.role(r.id), queryFn: () => usersApi.getRole(r.id), staleTime: 1000 * 60 * 5 });
        queryClient.prefetchQuery({ queryKey: rbacKeys.rolePermissions(r.id), queryFn: () => usersApi.getRolePermissions(r.id), staleTime: 1000 * 60 * 5 });
    };

    // ─── Delete handlers ────────────────────────────────────────
    const handleDeleteUser = (u: UserWithRoles) => setDeleteTarget(u);
    const handleDeleteRole = (r: Role) => setConfirmDeleteRole({ id: r.id, name: r.name });

    const confirmDeleteRoleAction = () => {
        const target = confirmDeleteRole();
        if (!target) return;
        deleteRoleMutation.mutate(target.id, {
            onSuccess: () => toast.success(`Rol "${target.name}" eliminado`),
            onError: (err: any) => toast.error(err?.message || 'Error al eliminar'),
        });
        setConfirmDeleteRole(null);
    };

    // ─── Bulk actions ───────────────────────────────────────────
    const handleBulkDelete = () => setShowBulkDeleteConfirm(true);

    const confirmBulkDelete = () => {
        const ids = selectedUsers().filter(u => u.isActive).map(u => u.id);
        if (ids.length === 0) return;
        bulkDeleteMutation.mutate(ids, {
            onSuccess: () => { toast.success(`${ids.length} usuarios desactivados`); setRowSelection({}); setShowBulkDeleteConfirm(false); },
            onError: (err: any) => toast.error(err.message || 'Error al eliminar'),
        });
    };

    const confirmBulkRestore = () => {
        const ids = selectedUsers().filter(u => !u.isActive).map(u => u.id);
        if (ids.length === 0) return;
        bulkRestoreMutation.mutate(ids, {
            onSuccess: () => { toast.success(`${ids.length} usuarios restaurados`); setRowSelection({}); setShowBulkRestoreConfirm(false); },
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

    // ─── Filter options ─────────────────────────────────────────
    const isActiveOptions = createMemo(() => buildFilterOptions(facetsQuery.data, 'isActive', isActiveLabels));

    const rolesOptions = createMemo(() => {
        const facets = facetsQuery.data?.roles ?? [];
        const activeMap = new Map();
        for (const name of rolesFilter()) activeMap.set(name, { label: name, value: name, count: 0 });
        for (const f of facets) activeMap.set(f.value, { label: f.value, value: f.value, count: f.count });
        return Array.from(activeMap.values()).sort((a, b) => b.count - a.count);
    });

    // ─── Column definitions ─────────────────────────────────────
    const columns = createMemo(() =>
        createUserColumns({
            onView: handleViewUser,
            onEdit: handleEditUser,
            onDelete: handleDeleteUser,
            onRestore: handleRestore,
            onRoleBadgeClick: (role) => setRoleDialog({ mode: 'permissions', roleId: role.id }),
            auth,
            filters: {
                isActive: { options: isActiveOptions, selected: isActiveFilter, onChange: handleFilterChange(setIsActiveFilter), isLoading: () => facetsQuery.isPending },
                roles: { options: rolesOptions, selected: rolesFilter, onChange: handleFilterChange(setRolesFilter), isLoading: () => facetsQuery.isPending },
            },
        })
    );

    // ─── Roles search (URL-synced) ──────────────────────────────
    const handleRolesSearch = (val: string) => {
        setRolesSearch(val);
        navigate({ search: ((prev: any) => ({ ...prev, rolesSearch: val || undefined })) as any, replace: true });
    };

    return {
        // Tab
        activeTab, handleTabChange, auth,

        // Panel (searchParams-driven sheets)
        panelSearch, handleClosePanel, handleCloseModal,

        // Users state
        userSearch, sorting, page, pageSize, rowSelection, setRowSelection,
        columnVisibility, setColumnVisibility, columnPinning, setColumnPinning,
        tableInstance, setTableInstance,

        // Users data
        usersQuery, users, usersMeta, totalUsers, selectedCount, selectedActiveCount, selectedInactiveCount,

        // Users handlers
        handleSearchInput, handleFirstPage, handleLastPage, handleNextPage, handlePrevPage,
        handlePageSizeChange, handleSortChange, handleNewUser, handleViewUser, handleEditUser,
        handlePrefetchUser, handleDeleteUser, handleRestore, handleCopySelection,
        handleBulkDelete, confirmBulkDelete, confirmBulkRestore, hasNextPage, hasPrevPage,

        // Roles state & data
        rolesSearch, handleRolesSearch, rolesQuery, roles, filteredRoles,
        roleDialog, setRoleDialog, usersDialog, setUsersDialog,

        // Roles handlers
        handleNewRole, handleEditRole, handleCloseRoleDialog, handlePrefetchRole,
        handleDeleteRole, confirmDeleteRoleAction,

        // Dialog state
        deleteTarget, setDeleteTarget, confirmDeleteRole, setConfirmDeleteRole,
        showBulkDeleteConfirm, setShowBulkDeleteConfirm, showBulkRestoreConfirm, setShowBulkRestoreConfirm,

        // Mutations
        bulkDeleteMutation, bulkRestoreMutation, deleteRoleMutation,

        // Columns
        columns,
    };
}

export type UsersState = ReturnType<typeof useUsersState>;
