/**
 * useUsersState — All state, queries, mutations, and handlers for UsersRolesPage.
 *
 * Extracts logic from the God Component so the page only renders.
 */
import { createSignal, createMemo, createEffect, batch } from 'solid-js';
import { useQueryClient } from '@tanstack/solid-query';
import { useNavigate, useSearch } from '@tanstack/solid-router';
import type { SortingState } from '@tanstack/solid-table';
import { toast } from 'solid-sonner';
import { copyToClipboard } from '@shared/utils/clipboard';
import { buildFilterOptions } from '@shared/utils/facets.utils';
import { useDataTable } from '@shared/hooks/useDataTable';
import { useDataTableSSE } from '@shared/hooks/useDataTableSSE';
import { useAuth } from '@modules/auth/store/auth.store';
import { RealtimeEvents } from '@app/schema/realtime-events';
import { getRoleDisplayLabel } from '@app/schema/utils';
import {
    rbacQueries,
    useRoles, useUsers,
    useUserFacets,
} from '../data/users.queries';
import {
    useDeleteRole,
    useDeactivateUser, useRestoreUser,
    useBulkDeactivateUsers, useBulkRestoreUsers,
    useResendUserInvitation,
} from '../data/users.mutations';
import { rbacKeys, DEFAULT_USERS_PAGE_SIZE } from '../data/users.keys';
import type { RoleType, UserListItemType, UsersFilters } from '@app/schema/dto';
import { createUserColumns } from '../data/user.columns';
import type { UsersRouteSearch } from '../users.routes';

// ─── Types & Constants ──────────────────────────────────────────
export type TabKey = 'users' | 'roles';

const MEMBERSHIP_STATUS_LABELS: Record<string, string> = {
    ACTIVE: 'Activo',
    PENDING: 'Invitación pendiente',
    SUSPENDED: 'Inactivo',
    true: 'Activo',
    false: 'Inactivo',
};

function arraysEqual(a?: string[], b?: string[]): boolean {
    const la = a ?? [];
    const lb = b ?? [];
    if (la.length !== lb.length) return false;
    return la.every((v, i) => v === lb[i]);
}

export function useUsersState() {
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const auth = useAuth();
    const search = useSearch({ strict: false }) as () => UsersRouteSearch;

    const initialSearchParams = search();

    // ─── Tab state (URL-synced) ─────────────────────────────────
    const activeTab = (): TabKey => {
        const t = search()?.tab;
        return t === 'roles' ? 'roles' : 'users';
    };

    const handleTabChange = (tab: string) => {
        navigate({ search: ((prev: any) => ({ ...prev, tab, rolesSearch: undefined })) as any, replace: true });
    };

    // ─── Users tab state (initialized from URL search params) ───
    let getQueryData = () => [] as UserListItemType[];
    let getQueryMeta = () => undefined as any;

    const initialSorting: SortingState = initialSearchParams?.sortBy
        ? [{ id: initialSearchParams.sortBy, desc: initialSearchParams.sortOrder === 'desc' }]
        : [];

    const tableState = useDataTable<UserListItemType>({
        data: () => getQueryData(),
        meta: () => getQueryMeta(),
        isCursorBased: false,
        initialPage: initialSearchParams?.page ?? 1,
        initialPageSize: initialSearchParams?.limit ?? DEFAULT_USERS_PAGE_SIZE,
        initialSearch: initialSearchParams?.search ?? '',
        initialSorting,
    });

    const [isActiveFilter, setIsActiveFilter] = createSignal<string[]>(initialSearchParams?.isActive ?? []);
    const [rolesFilter, setRolesFilter] = createSignal<string[]>(initialSearchParams?.roles ?? []);

    // ─── Roles tab state ────────────────────────────────────────
    const [rolesSearch, setRolesSearch] = createSignal(initialSearchParams?.rolesSearch ?? '');

    // ─── Confirm dialogs ────────────────────────────────────────
    const [deleteTarget, setDeleteTarget] = createSignal<UserListItemType | null>(null);
    const [confirmDeleteRole, setConfirmDeleteRole] = createSignal<{ id: number; name: string } | null>(null);
    const [showBulkDeleteConfirm, setShowBulkDeleteConfirm] = createSignal(false);
    const [showBulkRestoreConfirm, setShowBulkRestoreConfirm] = createSignal(false);

    // ─── Sync users table state back to URL (deep-linkable) ─────
    createEffect(() => {
        const cur = search();
        const nextPage = tableState.page() > 1 ? tableState.page() : undefined;
        const nextLimit = tableState.pageSize() !== DEFAULT_USERS_PAGE_SIZE ? tableState.pageSize() : undefined;
        const nextSearch = tableState.search().trim() || undefined;
        const nextSortBy = tableState.sortBy() || undefined;
        const nextSortOrder = nextSortBy ? tableState.sortOrder() : undefined;
        const nextIsActive = isActiveFilter().length > 0 ? isActiveFilter() : undefined;
        const nextRoles = rolesFilter().length > 0 ? rolesFilter() : undefined;

        const changed =
            cur?.page !== nextPage ||
            cur?.limit !== nextLimit ||
            cur?.search !== nextSearch ||
            cur?.sortBy !== nextSortBy ||
            cur?.sortOrder !== nextSortOrder ||
            !arraysEqual(cur?.isActive, nextIsActive) ||
            !arraysEqual(cur?.roles, nextRoles);

        if (changed) {
            navigate({
                search: ((prev: any) => ({
                    ...prev,
                    page: nextPage,
                    limit: nextLimit,
                    search: nextSearch,
                    sortBy: nextSortBy,
                    sortOrder: nextSortOrder,
                    isActive: nextIsActive,
                    roles: nextRoles,
                })) as any,
                replace: true,
            });
        }
    });

    // ─── Derived: filters ───────────────────────────────────────
    const usersFilters = createMemo<UsersFilters>(() => ({
        search: tableState.search() || undefined,
        page: tableState.page(),
        limit: tableState.pageSize(),
        sortBy: tableState.sortBy(),
        sortOrder: tableState.sortOrder(),
        isActive: isActiveFilter(),
        roles: rolesFilter(),
    }));

    const columnFiltersMap = () => ({
        isActive: isActiveFilter(),
        roles: rolesFilter(),
    });

    // ─── Queries & Mutations ────────────────────────────────────
    const facetsQuery = useUserFacets(tableState.search, columnFiltersMap);
    const usersQuery = useUsers(usersFilters);
    getQueryData = () => (usersQuery.data?.data ?? []) as UserListItemType[];
    getQueryMeta = () => usersQuery.data?.meta;
    const rolesQuery = useRoles();
    const deactivateMutation = useDeactivateUser();
    const restoreMutation = useRestoreUser();
    const deleteRoleMutation = useDeleteRole();
    const bulkDeleteMutation = useBulkDeactivateUsers();
    const bulkRestoreMutation = useBulkRestoreUsers();
    const resendInvitationMutation = useResendUserInvitation();

    // ─── Background Next-Page Prefetch ──────────────────────────
    createEffect(() => {
        const meta = usersQuery.data?.meta;
        if (!meta?.hasNextPage) return;
        const current = usersFilters();
        queryClient.prefetchQuery(rbacQueries.list({ ...current, page: (current.page ?? 1) + 1 }));
    });

    // ─── SSE (Users + Roles) ────────────────────────────────────
    useDataTableSSE({
        room: 'users',
        queryKey: rbacKeys.lists(),
        events: [RealtimeEvents.USER.CREATED, RealtimeEvents.USER.UPDATED, RealtimeEvents.USER.DELETED],
    });
    useDataTableSSE({
        room: 'users',
        queryKey: rbacKeys.roles(),
        events: [RealtimeEvents.ROLE.CREATED, RealtimeEvents.ROLE.UPDATED, RealtimeEvents.ROLE.DELETED],
    });

    // ─── Derived data ───────────────────────────────────────────
    const users = (): UserListItemType[] => (usersQuery.data?.data ?? []) as UserListItemType[];
    const usersMeta = () => usersQuery.data?.meta;
    const totalUsers = () => usersMeta()?.total ?? 0;

    const roles = () => rolesQuery.data ?? [];
    const filteredRoles = createMemo(() => {
        const term = rolesSearch().toLowerCase();
        if (!term) return roles();
        return roles().filter(r =>
            r.name.toLowerCase().includes(term) ||
            getRoleDisplayLabel(r.name).toLowerCase().includes(term) ||
            r.description?.toLowerCase().includes(term)
        );
    });

    const selectedActiveCount = () => tableState.selectedItems().filter(u => u.isActive).length;
    const selectedInactiveCount = () => tableState.selectedItems().filter(u => !u.isActive).length;

    const handleFilterChange = (setter: (updater: (prev: string[]) => string[]) => void) => {
        return (values: string[]) => {
            batch(() => { setter(() => values); tableState.setPage(1); });
        };
    };

    const handleRestore = (user: UserListItemType) => {
        restoreMutation.mutate(user.id, {
            onSuccess: () => toast.success(`Se ha restaurado el usuario '${user.username}'`),
            onError: (err: any) => toast.error(err.message || 'Error al restaurar'),
        });
    };

    const handleResendInvitation = (user: UserListItemType) => {
        resendInvitationMutation.mutate(user.id, {
            onSuccess: (res) => {
                if (res.emailSent) {
                    toast.success(`Invitación reenviada a ${user.email}`, {
                        action: {
                            label: 'Copiar enlace',
                            onClick: () => {
                                copyToClipboard(res.inviteUrl).then(ok => {
                                    if (ok) toast.success('Enlace de activación copiado');
                                });
                            },
                        },
                    });
                } else {
                    toast.warning(`No se pudo entregar el correo (${res.emailError ?? 'error SMTP'}). Copia el enlace manualmente.`, {
                        duration: 8000,
                        action: {
                            label: 'Copiar enlace',
                            onClick: () => {
                                copyToClipboard(res.inviteUrl).then(ok => {
                                    if (ok) toast.success('Enlace de activación copiado');
                                });
                            },
                        },
                    });
                }
            },
            onError: (err: any) => toast.error(err?.message || 'Error al reenviar invitación'),
        });
    };

    const handlePrefetchUser = (u: UserListItemType) => {
        queryClient.prefetchQuery(rbacQueries.user(u.id));
    };

    const handlePrefetchRole = (r: RoleType) => {
        queryClient.prefetchQuery(rbacQueries.role(r.id));
        queryClient.prefetchQuery(rbacQueries.rolePermissions(r.id));
        queryClient.prefetchQuery(rbacQueries.permissions());
    };

    // ─── Delete handlers ────────────────────────────────────────
    const handleDeleteUser = (u: UserListItemType) => setDeleteTarget(u);
    const handleDeleteRole = (r: RoleType) => setConfirmDeleteRole({ id: r.id, name: r.name });

    const confirmDeleteRoleAction = () => {
        const target = confirmDeleteRole();
        if (!target) return;
        deleteRoleMutation.mutate(target.id, {
            onSuccess: () => toast.success(`Rol "${getRoleDisplayLabel(target.name)}" eliminado`),
            onError: (err: any) => toast.error(err?.message || 'Error al eliminar'),
        });
        setConfirmDeleteRole(null);
    };

    // ─── Bulk actions ───────────────────────────────────────────
    const handleBulkDelete = () => setShowBulkDeleteConfirm(true);

    const confirmBulkDelete = () => {
        const ids = tableState.selectedItems().filter(u => u.isActive).map(u => u.id);
        if (ids.length === 0) return;
        bulkDeleteMutation.mutate(ids, {
            onSuccess: () => { toast.success(`${ids.length} usuarios desactivados`); tableState.setRowSelection({}); setShowBulkDeleteConfirm(false); },
            onError: (err: any) => toast.error(err.message || 'Error al eliminar'),
        });
    };

    const confirmBulkRestore = () => {
        const ids = tableState.selectedItems().filter(u => !u.isActive).map(u => u.id);
        if (ids.length === 0) return;
        bulkRestoreMutation.mutate(ids, {
            onSuccess: () => { toast.success(`${ids.length} usuarios restaurados`); tableState.setRowSelection({}); setShowBulkRestoreConfirm(false); },
            onError: (err: any) => toast.error(err.message || 'Error al restaurar'),
        });
    };

    const handleCopySelection = async () => {
        const selected = tableState.selectedItems();
        if (selected.length === 0) return;
        const text = selected.map(u => {
            const parts = [
                `Usuario: ${u.username} (${u.email})`,
                u.roles.length > 0 ? `Roles: ${u.roles.map(r => getRoleDisplayLabel(r.name)).join(', ')}` : null,
            ].filter(Boolean);
            return parts.join(' | ');
        }).join('\n');
        const ok = await copyToClipboard(text);
        if (ok) toast.success(`Copiado ${selected.length} usuarios al portapapeles`);
        else toast.error('Error al copiar al portapapeles');
        tableState.setRowSelection({});
    };

    // ─── Filter options ─────────────────────────────────────────
    const isActiveOptions = createMemo(() => buildFilterOptions(facetsQuery.data, 'isActive', MEMBERSHIP_STATUS_LABELS));

    const rolesOptions = createMemo(() => {
        const facets = facetsQuery.data?.roles ?? [];
        const activeMap = new Map<string, { label: string; value: string; count: number }>();
        for (const name of rolesFilter()) {
            activeMap.set(name, { label: getRoleDisplayLabel(name), value: name, count: 0 });
        }
        for (const f of facets) {
            activeMap.set(f.value, { label: getRoleDisplayLabel(f.value), value: f.value, count: f.count });
        }
        return Array.from(activeMap.values()).sort((a, b) => b.count - a.count);
    });

    // ─── Column definitions ─────────────────────────────────────
    const columns = createMemo(() =>
        createUserColumns({
            onDelete: handleDeleteUser,
            onRestore: handleRestore,
            onResendInvitation: handleResendInvitation,
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
        // Spread base table state/handlers
        ...tableState,
        userSearch: tableState.search,
        handleSortChange: tableState.handleSortingChange,

        // Tab
        activeTab, handleTabChange, auth,

        // Users data
        usersQuery, users, usersMeta, totalUsers, selectedActiveCount, selectedInactiveCount,

        // Users handlers
        handlePrefetchUser, handleDeleteUser, handleRestore, handleResendInvitation, handleCopySelection,
        handleBulkDelete, confirmBulkDelete, confirmBulkRestore,

        // Roles state & data
        rolesSearch, handleRolesSearch, rolesQuery, roles, filteredRoles,
        handlePrefetchRole, handleDeleteRole, confirmDeleteRoleAction,

        // Dialog state
        deleteTarget, setDeleteTarget, confirmDeleteRole, setConfirmDeleteRole,
        showBulkDeleteConfirm, setShowBulkDeleteConfirm, showBulkRestoreConfirm, setShowBulkRestoreConfirm,

        // Mutations
        bulkDeleteMutation, bulkRestoreMutation, deleteRoleMutation, deactivateMutation, resendInvitationMutation,

        // Columns
        columns,
    };
}

export type UsersState = ReturnType<typeof useUsersState>;
