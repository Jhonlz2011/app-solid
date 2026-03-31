/**
 * UsersRolesPage — Orchestrator component.
 *
 * All state and logic extracted to useUsersState hook.
 * This component only handles layout and wiring of sub-components.
 */
import { Component, For, Show } from 'solid-js';
import { toast } from 'solid-sonner';
import { useNavigate, Outlet } from '@tanstack/solid-router';
// import { useIsMobile } from '@shared/hooks/useIsMobile';
import { useUsersState } from '../hooks/useUsersState';

// Shared UI
import { DataTable } from '@shared/ui/DataTable';
import { PageHeader } from '@shared/ui/PageHeader';
import { SearchInput } from '@shared/ui/SearchInput';
import { Tabs, TabsList, TabsTrigger } from '@shared/ui/Tabs';
import { DropdownMenu } from '@shared/ui/DropdownMenu';
import { DataTableSelectionBar, SelectionBarAction, SelectionBarSeparator } from '@shared/ui/DataTable/DataTableSelectionBar';
import { DataTableColumnVisibility } from '@shared/ui/DataTable/DataTableColumnVisibility';
import Button from '@shared/ui/Button';
import ConfirmDialog from '@shared/ui/ConfirmDialog';
import UserDeleteDialog from '../components/UserDeleteDialog';

// Feature components
import RoleCard from '../components/RoleCard';
import RoleFormDialog from '../components/RoleFormDialog';
import RoleUsersDialog from '../components/RoleUsersDialog';

// Icons
import {
    PlusIcon, TrashIcon, UsersIcon, IdCardIcon, UserKeyIcon,
    RotateCcwIcon, ChevronsUpDownIcon, CopyIcon,
} from '@shared/ui/icons';

const UsersRolesPage: Component = () => {
    // const isMobile = useIsMobile();
    const navigate = useNavigate();
    const state = useUsersState();

    return (
        <div class="h-full flex flex-col bg-gradient-to-br from-background via-background to-surface/20">
            {/* Native Deep-Nested Routes for User Modals */}
            <Outlet />

            {/* Role FormDialog */}
            <RoleFormDialog
                mode={state.roleDialog()?.mode ?? 'create'}
                roleId={state.roleDialog()?.roleId}
                isOpen={state.roleDialog() !== null}
                onClose={state.handleCloseRoleDialog}
            />

            {/* Header */}
            <div class="flex-shrink-0 p-3 sm:p-4 space-y-4">
                <PageHeader
                    icon={<UserKeyIcon />}
                    iconBg="linear-gradient(135deg, #6366f1, #9477d6ff)"
                    title="Usuarios y Roles"
                    count={state.activeTab() === 'users' ? state.totalUsers() : state.roles().length}
                    info="Gestiona usuarios, roles y permisos de acceso al sistema."
                    actions={
                        <div class="flex items-center gap-3">
                            <Tabs value={state.activeTab()} onChange={state.handleTabChange}>
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

                            <Show when={state.activeTab() === 'users' && state.auth.canAdd('users')}>
                                <Button
                                    to="/users/new"
                                    search={true}
                                    preload="intent"
                                    icon={<PlusIcon />}
                                >
                                    <span class="hidden @md:inline">Nuevo</span>
                                </Button>
                            </Show>
                            <Show when={state.activeTab() === 'roles' && state.auth.canAdd('roles')}>
                                <Button onClick={state.handleNewRole} icon={<PlusIcon />}>
                                    <span class="hidden @md:inline">Nuevo </span>
                                </Button>
                            </Show>
                        </div>
                    }
                />

                {/* Toolbar — Users */}
                <Show when={state.activeTab() === 'users'}>
                    <div class="flex flex-wrap items-center gap-2 sm:gap-3">
                        <SearchInput
                            value={state.userSearch()}
                            onSearch={state.handleSearchInput}
                            placeholder="Buscar usuarios..."
                            class="flex-1 min-w-[150px] max-w-md"
                        />
                        <DataTableColumnVisibility table={state.tableInstance()} />
                    </div>
                </Show>

                {/* Toolbar — Roles */}
                <Show when={state.activeTab() === 'roles'}>
                    <SearchInput
                        value={state.rolesSearch()}
                        onSearch={state.handleRolesSearch}
                        placeholder="Buscar roles..."
                        class="max-w-md"
                    />
                </Show>
            </div>

            {/* Content */}
            <div class="flex-1 min-h-0 px-3 pb-3 sm:px-4 sm:pb-4 overflow-hidden">
                {/* Users tab — DataTable */}
                <Show when={state.activeTab() === 'users'}>
                    <div class="bg-card border border-border rounded-2xl shadow-card-soft h-full overflow-auto relative">
                        <DataTable
                            data={state.users()}
                            columns={state.columns()}
                            isLoading={state.usersQuery.isPending}
                            isPlaceholderData={state.usersQuery.isPlaceholderData}
                            pagination={{ pageIndex: state.page() - 1, pageSize: state.pageSize() }}
                            onPaginationChange={() => { }}
                            pageCount={state.usersMeta()?.pageCount ?? 1}
                            totalRows={state.totalUsers()}
                            cursorPagination={{
                                hasNextPage: state.hasNextPage(),
                                hasPrevPage: state.hasPrevPage(),
                                onNextPage: state.handleNextPage,
                                onPrevPage: state.handlePrevPage,
                                onFirstPage: state.handleFirstPage,
                                onLastPage: state.handleLastPage,
                                onPageSizeChange: state.handlePageSizeChange,
                            }}
                            sorting={state.sorting()}
                            onSortingChange={state.handleSortChange}
                            enableRowSelection={true}
                            rowSelection={state.rowSelection()}
                            onRowSelectionChange={state.setRowSelection}
                            getRowId={(row) => String(row.id)}
                            enableColumnPinning={true}
                            columnVisibility={state.columnVisibility()}
                            onColumnVisibilityChange={state.setColumnVisibility}
                            columnPinning={state.columnPinning()}
                            onColumnPinningChange={state.setColumnPinning}
                            onRowHover={state.handlePrefetchUser}
                            enableVirtualization={false}
                            estimatedRowHeight={56}
                            emptyIcon={<UsersIcon />}
                            emptyMessage="No hay usuarios"
                            emptyDescription="Crea uno nuevo para comenzar"
                            tableRef={(table) => state.setTableInstance(table)}
                        />
                    </div>
                </Show>

                {/* Roles tab — Card Grid */}
                <Show when={state.activeTab() === 'roles'}>
                    <Show
                        when={!state.rolesQuery.isPending}
                        fallback={
                            <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                                <For each={Array(6)}>
                                    {() => <div class="bg-card border border-border rounded-2xl p-5 h-36 animate-pulse" />}
                                </For>
                            </div>
                        }
                    >
                        <Show
                            when={state.filteredRoles().length > 0}
                            fallback={
                                <div class="flex flex-col items-center justify-center py-20 text-center">
                                    <IdCardIcon class="size-10 opacity-20 mb-4" />
                                    <p class="text-muted">
                                        {state.rolesSearch() ? 'Sin resultados para la búsqueda' : 'No hay roles definidos'}
                                    </p>
                                </div>
                            }
                        >
                            <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                                <For each={state.filteredRoles()}>
                                    {(role) => (
                                        <RoleCard
                                            role={role}
                                            onEdit={() => state.handleEditRole(role)}
                                            onDelete={() => state.handleDeleteRole(role)}
                                            onUsersClick={() => state.setUsersDialog({ roleId: role.id, roleName: role.name })}
                                            onPermissionsClick={() => state.setRoleDialog({ mode: 'permissions', roleId: role.id })}
                                            onMouseEnter={() => state.handlePrefetchRole(role)}
                                        />
                                    )}
                                </For>
                            </div>
                        </Show>
                    </Show>
                </Show>
            </div>

            {/* Selection Bar */}
            <DataTableSelectionBar
                selectedCount={state.selectedCount()}
                totalRows={state.totalUsers()}
                onClearSelection={() => state.setRowSelection({})}
            >
                <SelectionBarAction icon={<CopyIcon class="size-4" />} label="Copiar" onClick={state.handleCopySelection} iconOnMobile />
                <SelectionBarSeparator />
                <Show when={state.selectedActiveCount() > 0 && state.selectedInactiveCount() === 0}>
                    <SelectionBarAction
                        icon={<TrashIcon class="size-4" />} label="Eliminar" variant="danger"
                        onClick={state.handleBulkDelete} loading={state.bulkDeleteMutation.isPending} loadingText="Eliminando..."
                    />
                </Show>
                <Show when={state.selectedInactiveCount() > 0 && state.selectedActiveCount() === 0}>
                    <SelectionBarAction
                        icon={<RotateCcwIcon class="size-4" />} label="Restaurar" variant="success"
                        onClick={() => state.setShowBulkRestoreConfirm(true)} loading={state.bulkRestoreMutation.isPending} loadingText="Restaurando..."
                    />
                </Show>
                <Show when={state.selectedActiveCount() > 0 && state.selectedInactiveCount() > 0}>
                    <DropdownMenu placement="top-start">
                        <DropdownMenu.Trigger variant="ghost" size="sm" class="h-8 px-2.5 text-sm gap-1.5 focus-visible:ring-0">
                            <span>Acciones</span>
                            <ChevronsUpDownIcon class="size-3.5" />
                        </DropdownMenu.Trigger>
                        <DropdownMenu.Content class="min-w-[180px]">
                            <DropdownMenu.Item onSelect={state.handleBulkDelete} destructive>
                                <TrashIcon class="size-4 mr-2" />
                                <span class="flex-1 font-medium">Eliminar Activos</span>
                                <span class="bg-danger/20 text-danger font-bold text-xs px-1.5 py-0.5 rounded tabular-nums">{state.selectedActiveCount()}</span>
                            </DropdownMenu.Item>
                            <DropdownMenu.Item onSelect={() => state.setShowBulkRestoreConfirm(true)}>
                                <RotateCcwIcon class="size-4 mr-2 text-emerald-500" />
                                <span class="flex-1 text-emerald-500 font-medium">Restaurar Inactivos</span>
                                <span class="bg-emerald-500/20 text-emerald-500 font-bold text-xs px-1.5 py-0.5 rounded tabular-nums">{state.selectedInactiveCount()}</span>
                            </DropdownMenu.Item>
                        </DropdownMenu.Content>
                    </DropdownMenu>
                </Show>
            </DataTableSelectionBar>

            {/* Dialogs */}
            <UserDeleteDialog
                user={state.deleteTarget()}
                onClose={() => state.setDeleteTarget(null)}
                onSuccess={() => toast.success('Usuario eliminado')}
            />
            <ConfirmDialog
                isOpen={state.showBulkDeleteConfirm()}
                onClose={() => state.setShowBulkDeleteConfirm(false)}
                onConfirm={state.confirmBulkDelete}
                title={`Desactivar ${state.selectedActiveCount()} usuarios`}
                description="Los usuarios seleccionados quedarán inactivos. Podrás restaurarlos en cualquier momento."
                confirmLabel="Desactivar" loadingText="Desactivando..." variant="danger"
                isLoading={state.bulkDeleteMutation.isPending}
            />
            <ConfirmDialog
                isOpen={state.showBulkRestoreConfirm()}
                onClose={() => state.setShowBulkRestoreConfirm(false)}
                onConfirm={state.confirmBulkRestore}
                title={`Restaurar ${state.selectedInactiveCount()} usuarios`}
                description="Los usuarios seleccionados volverán a estar activos con todos sus roles."
                confirmLabel="Restaurar" loadingText="Restaurando..." variant="success"
                isLoading={state.bulkRestoreMutation.isPending}
            />
            <ConfirmDialog
                isOpen={state.confirmDeleteRole() !== null}
                onClose={() => state.setConfirmDeleteRole(null)}
                onConfirm={state.confirmDeleteRoleAction}
                title="Eliminar rol"
                description={`¿Eliminar "${state.confirmDeleteRole()?.name}"? Esta acción no se puede deshacer.`}
                variant="danger"
            />

            {/* Role Users Dialog */}
            <RoleUsersDialog
                roleId={state.usersDialog()?.roleId ?? null}
                roleName={state.usersDialog()?.roleName ?? ''}
                isOpen={state.usersDialog() !== null}
                onClose={() => state.setUsersDialog(null)}
            />
        </div>
    );
};

export default UsersRolesPage;
