import { Component, For, Show, createMemo, createSignal, createEffect } from 'solid-js';
import { createSolidTable, flexRender, getCoreRowModel, getSortedRowModel, getFilteredRowModel, type ColumnDef, type SortingState } from '@tanstack/solid-table';
import { Toaster, toast } from 'solid-sonner';
import { Portal } from 'solid-js/web';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@shared/ui/table';

// Atomic Components
import { RoleBadge, StatusBadge, ActionBadge } from '@shared/ui/Badge';
import { PageHeader } from '@shared/ui/PageHeader';
import { SearchInput } from '@shared/ui/SearchInput';
import { TabPills, type Tab } from '@shared/ui/TabPills';
import { SkeletonLoader } from '@shared/ui/SkeletonLoader';
import { EmptyState } from '@shared/ui/EmptyState';

// RBAC Service
import {
    useRoles,
    usePermissions,
    useUsersWithRoles,
    useRolePermissions,
    useCreateRole,
    useUpdateRole,
    useDeleteRole,
    useUpdateRolePermissions,
    useAssignUserRoles,
    useCreateUser,
    useRoleUsers,
    useRemoveUserFromRole,
    useUpdateUser,
    useDeleteUser,
} from '../data/users.queries';
import type { Role, Permission, UserWithRoles } from '../models/users.types';

import Input from '@shared/ui/Input';
import Checkbox from '@shared/ui/Checkbox';

// Icons - from shared library
import { UsersIcon, PlusIcon, ShieldIcon, KeyIcon, EditIcon, TrashIcon, SearchIcon } from '@shared/ui/icons';

type TabType = 'users' | 'roles';

// Module labels for permissions grouping
const moduleLabels: Record<string, string> = {
    dashboard: 'Panel de Control', crm: 'CRM', clients: 'Clientes', visits: 'Visitas Técnicas',
    budgets: 'Presupuestos', invoices: 'Facturación', operations: 'Operaciones', work_orders: 'Órdenes de Trabajo',
    schedule: 'Cronograma', projects: 'Proyectos', production: 'Producción', planning: 'Planificación',
    materials: 'Materiales', quality: 'Calidad', inventory: 'Inventario', products: 'Productos',
    movements: 'Movimientos', orders: 'Pedidos', stock_taking: 'Toma Física', remission_guides: 'Guías de Remisión',
    purchases: 'Compras', suppliers: 'Proveedores', purchase_quotes: 'Cotizaciones Compra', purchase_orders: 'Órdenes Compra',
    purchase_invoices: 'Facturas Compra', finance: 'Finanzas', documents: 'Documentos', retentions: 'Retenciones',
    receivable: 'Cuentas por Cobrar', payable: 'Cuentas por Pagar', petty_cash: 'Caja Chica', hr: 'Talento Humano',
    payroll: 'Nómina', schedules: 'Horarios', hours: 'Reporte Horas', system: 'Sistema', config: 'Configuración',
    users: 'Usuarios', audit: 'Auditoría', roles: 'Roles', permissions: 'Permisos',
};

const UsersRolesPage: Component = () => {
    // State
    const [activeTab, setActiveTab] = createSignal<TabType>('users');
    const [globalFilter, setGlobalFilter] = createSignal('');
    const [sorting, setSorting] = createSignal<SortingState>([]);

    // Modal states
    const [showRoleModal, setShowRoleModal] = createSignal(false);
    const [editingRole, setEditingRole] = createSignal<Role | null>(null);
    const [showPermissionModal, setShowPermissionModal] = createSignal(false);
    const [selectedRoleForPerms, setSelectedRoleForPerms] = createSignal<Role | null>(null);
    const [showUserRoleModal, setShowUserRoleModal] = createSignal(false);
    const [selectedUser, setSelectedUser] = createSignal<UserWithRoles | null>(null);
    const [showUserModal, setShowUserModal] = createSignal(false);
    const [showUserEditModal, setShowUserEditModal] = createSignal(false);
    const [editingUser, setEditingUser] = createSignal<UserWithRoles | null>(null);
    const [showRoleUsersModal, setShowRoleUsersModal] = createSignal(false);
    const [selectedRoleForUsers, setSelectedRoleForUsers] = createSignal<Role | null>(null);

    // Queries (with placeholderData for 0ms perceived loading)
    const rolesQuery = useRoles();
    const permissionsQuery = usePermissions();
    const usersQuery = useUsersWithRoles();

    // Mutations (with optimistic updates)
    const createRoleMutation = useCreateRole();
    const updateRoleMutation = useUpdateRole();
    const deleteRoleMutation = useDeleteRole();
    const updateRolePermsMutation = useUpdateRolePermissions();
    const assignUserRolesMutation = useAssignUserRoles();
    const createUserMutation = useCreateUser();
    const updateUserMutation = useUpdateUser();
    const deleteUserMutation = useDeleteUser();
    const removeUserFromRoleMutation = useRemoveUserFromRole();

    // Derived data
    const users = () => usersQuery.data ?? [];
    const roles = () => rolesQuery.data ?? [];
    const permissions = () => permissionsQuery.data;

    // Filtered data (reactive)
    const filteredUsers = createMemo(() => {
        const term = globalFilter().toLowerCase();
        if (!term) return users();
        return users().filter(u =>
            u.username.toLowerCase().includes(term) ||
            u.email.toLowerCase().includes(term) ||
            u.roles.some(r => r.name.toLowerCase().includes(term))
        );
    });

    const filteredRoles = createMemo(() => {
        const term = globalFilter().toLowerCase();
        if (!term) return roles();
        return roles().filter(r =>
            r.name.toLowerCase().includes(term) ||
            r.description?.toLowerCase().includes(term)
        );
    });

    // Tabs configuration
    const tabs = createMemo<Tab[]>(() => [
        {
            key: 'users',
            label: 'Usuarios',
            icon: <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg>,
            count: users().length
        },
        {
            key: 'roles',
            label: 'Roles',
            icon: <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>,
            count: roles().length
        },
    ]);

    // User table columns
    const userColumns: ColumnDef<UserWithRoles>[] = [
        {
            id: 'avatar',
            header: '',
            size: 60,
            cell: (info) => (
                <div class="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500/20 to-purple-600/40 flex items-center justify-center ring-1 ring-white/10">
                    <span class="text-sm font-semibold" style={{ color: 'var(--color-primary)' }}>
                        {info.row.original.username.slice(0, 2).toUpperCase()}
                    </span>
                </div>
            ),
        },
        {
            accessorKey: 'username',
            header: 'Usuario',
            size: 180,
            cell: (info) => (
                <div class="min-w-0">
                    <div class="font-medium">{info.getValue<string>()}</div>
                    <div class="text-xs text-muted truncate">{info.row.original.email}</div>
                </div>
            ),
        },
        {
            id: 'roles',
            header: 'Roles',
            size: 200,
            cell: (info) => (
                <div class="flex flex-wrap gap-1">
                    <Show when={info.row.original.roles.length > 0} fallback={<span class="text-muted text-sm">Sin roles</span>}>
                        <For each={info.row.original.roles}>
                            {(userRole) => {
                                const fullRole = roles().find(r => r.name === userRole.name);
                                return (
                                    <RoleBadge
                                        name={userRole.name}
                                        onClick={fullRole ? () => handleManagePermissions(fullRole) : undefined}
                                    />
                                );
                            }}
                        </For>
                    </Show>
                </div>
            ),
        },
        {
            accessorKey: 'isActive',
            header: 'Estado',
            size: 100,
            cell: (info) => <StatusBadge isActive={info.getValue<boolean | null>()} />,
        },
        {
            id: 'actions',
            header: '',
            size: 120,
            cell: (info) => (
                <div class="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                    <button
                        onClick={(e) => { e.stopPropagation(); handleEditUserRoles(info.row.original); }}
                        class="p-1.5 rounded-lg hover:bg-blue-500/20 text-muted hover:text-blue-400"
                        title="Gestionar Roles"
                    >
                        <ShieldIcon class='size-4' />
                    </button>
                    <button
                        onClick={(e) => { e.stopPropagation(); handleEditUser(info.row.original); }}
                        class="p-1.5 rounded-lg hover:bg-amber-500/20 text-muted hover:text-amber-400"
                        title="Editar Usuario"
                    >
                        <EditIcon class='size-4'/>
                    </button>
                    <button
                        onClick={(e) => { e.stopPropagation(); handleDeleteUser(info.row.original); }}
                        class="p-1.5 rounded-lg hover:bg-red-500/20 text-muted hover:text-red-400"
                        title="Eliminar Usuario"
                    >
                        <TrashIcon class='size-4' />
                    </button>
                </div>
            ),
        },
    ];

    // User table instance
    const userTable = createSolidTable({
        get data() { return filteredUsers() },
        columns: userColumns,
        getCoreRowModel: getCoreRowModel(),
        getSortedRowModel: getSortedRowModel(),
        getFilteredRowModel: getFilteredRowModel(),
        onSortingChange: setSorting,
        state: {
            get sorting() { return sorting() },
        },
    });

    // Handlers
    const handleEditUserRoles = (user: UserWithRoles) => {
        setSelectedUser(user);
        setShowUserRoleModal(true);
    };

    const handleNewRole = () => {
        setEditingRole(null);
        setShowRoleModal(true);
    };

    const handleNewUser = () => {
        setShowUserModal(true);
    };

    const handleEditRole = (role: Role) => {
        setEditingRole(role);
        setShowRoleModal(true);
    };

    const handleDeleteRole = (role: Role) => {
        if (role.name === 'superadmin' || role.name === 'admin') {
            toast.error('No se pueden eliminar roles del sistema');
            return;
        }
        if (confirm(`¿Eliminar rol "${role.name}"?`)) {
            deleteRoleMutation.mutate(role.id, {
                onSuccess: () => toast.success('Rol eliminado'),
                onError: (err) => toast.error(`Error: ${err.message}`),
            });
        }
    };

    const handleManagePermissions = (role: Role) => {
        setSelectedRoleForPerms(role);
        setShowPermissionModal(true);
    };

    const handleViewRoleUsers = (role: Role) => {
        setSelectedRoleForUsers(role);
        setShowRoleUsersModal(true);
    };

    const handleEditUser = (user: UserWithRoles) => {
        setEditingUser(user);
        setShowUserEditModal(true);
    };

    const handleDeleteUser = (user: UserWithRoles) => {
        if (confirm(`¿Eliminar usuario "${user.username}"? Esta acción desactivará la cuenta.`)) {
            deleteUserMutation.mutate(user.id, {
                onSuccess: () => toast.success('Usuario eliminado'),
                onError: (err) => toast.error(`Error: ${err.message}`),
            });
        }
    };

    return (
        <div class="h-full flex flex-col bg-gradient-to-br from-background via-background to-surface/20">
            <Toaster position="top-right" richColors closeButton />

            {/* Header */}
            <div class="flex-shrink-0 p-6 space-y-5">
                <PageHeader
                    icon={<UsersIcon />}
                    iconBg="linear-gradient(135deg, #10b981, #14b8a6)"
                    title="Usuarios y Roles"
                    subtitle="Gestión de acceso y permisos del sistema"
                    actions={
                        <>
                            <Show when={activeTab() === 'users'}>
                                <button onClick={handleNewUser} class="btn btn-primary gap-2">
                                    <PlusIcon /> Nuevo Usuario
                                </button>
                            </Show>
                            <Show when={activeTab() === 'roles'}>
                                <button onClick={handleNewRole} class="btn btn-primary gap-2">
                                    <PlusIcon /> Nuevo Rol
                                </button>
                            </Show>
                        </>
                    }
                />

                {/* Toolbar */}
                <div class="flex flex-wrap items-center gap-3">
                    <SearchInput
                        value={globalFilter()}
                        onSearch={setGlobalFilter}
                        placeholder={activeTab() === 'users' ? 'Buscar usuarios...' : 'Buscar roles...'}
                        class="flex-1 min-w-[200px] max-w-md"
                    />
                    <TabPills
                        tabs={tabs()}
                        active={activeTab()}
                        onChange={(key) => setActiveTab(key as TabType)}
                    />
                </div>
            </div>

            {/* Content */}
            <div class="flex-1 min-h-0 px-6 pb-6 overflow-hidden flex flex-col">
                {/* Users Tab */}
                <Show when={activeTab() === 'users'}>
                    <div class="bg-card border border-border rounded-2xl shadow-card-soft h-full overflow-auto relative">
                        <Show when={!usersQuery.isLoading} fallback={<SkeletonLoader type="table-row" count={5} />}>
                            <Show when={filteredUsers().length > 0} fallback={
                                <EmptyState message="No hay usuarios" description="Crea un nuevo usuario para comenzar" />
                            }>
                                <Table>
                                    <TableHeader class="sticky top-0 z-10 bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80">
                                        <For each={userTable.getHeaderGroups()}>
                                            {(headerGroup) => (
                                                <TableRow>
                                                    <For each={headerGroup.headers}>
                                                        {(header) => (
                                                            <TableHead class="text-xs uppercase tracking-wider text-muted font-semibold" style={{ width: `${header.getSize()}px` }}>
                                                                <Show when={!header.isPlaceholder}>
                                                                    {flexRender(header.column.columnDef.header, header.getContext())}
                                                                </Show>
                                                            </TableHead>
                                                        )}
                                                    </For>
                                                </TableRow>
                                            )}
                                        </For>
                                    </TableHeader>
                                    <TableBody>
                                        <For each={userTable.getRowModel().rows}>
                                            {(row) => (
                                                <TableRow class="group cursor-pointer hover:bg-surface/50">
                                                    <For each={row.getVisibleCells()}>
                                                        {(cell) => <TableCell>{flexRender(cell.column.columnDef.cell, cell.getContext())}</TableCell>}
                                                    </For>
                                                </TableRow>
                                            )}
                                        </For>
                                    </TableBody>
                                </Table>
                            </Show>
                        </Show>
                    </div>
                </Show>

                {/* Roles Tab */}
                <Show when={activeTab() === 'roles'}>
                    <Show when={!rolesQuery.isLoading} fallback={<SkeletonLoader type="card" count={6} />}>
                        <Show when={filteredRoles().length > 0} fallback={
                            <EmptyState message="No hay roles" description="Crea un nuevo rol para comenzar" />
                        }>
                            <div class="grid gap-4 md:grid-cols-2 lg:grid-cols-3 overflow-auto">
                                <For each={filteredRoles()}>
                                    {(role) => (
                                        <RoleCard
                                            role={role}
                                            onManagePermissions={() => handleManagePermissions(role)}
                                            onViewUsers={() => handleViewRoleUsers(role)}
                                            onEdit={() => handleEditRole(role)}
                                            onDelete={() => handleDeleteRole(role)}
                                        />
                                    )}
                                </For>
                            </div>
                        </Show>
                    </Show>
                </Show>
            </div>

            {/* Modals */}
            <Show when={showRoleModal()}>
                <RoleFormModal
                    role={editingRole()}
                    onClose={() => setShowRoleModal(false)}
                    onSave={(data) => {
                        const editing = editingRole();
                        if (editing) {
                            updateRoleMutation.mutate({ id: editing.id, ...data }, {
                                onSuccess: () => { setShowRoleModal(false); toast.success('Rol actualizado'); },
                                onError: (err) => toast.error(`Error: ${err.message}`),
                            });
                        } else {
                            createRoleMutation.mutate(data, {
                                onSuccess: () => { setShowRoleModal(false); toast.success('Rol creado'); },
                                onError: (err) => toast.error(`Error: ${err.message}`),
                            });
                        }
                    }}
                    isPending={createRoleMutation.isPending || updateRoleMutation.isPending}
                />
            </Show>

            <Show when={showUserModal()}>
                <UserFormModal
                    roles={roles()}
                    onClose={() => setShowUserModal(false)}
                    onSave={(data) => {
                        createUserMutation.mutate(data, {
                            onSuccess: () => { setShowUserModal(false); toast.success('Usuario creado'); },
                            onError: (err) => toast.error(`Error: ${err.message}`),
                        });
                    }}
                    isPending={createUserMutation.isPending}
                />
            </Show>

            <Show when={showPermissionModal() && selectedRoleForPerms()}>
                <PermissionAssignModal
                    role={selectedRoleForPerms()!}
                    allPermissions={permissions()?.all ?? []}
                    groupedPermissions={permissions()?.grouped ?? {}}
                    onClose={() => setShowPermissionModal(false)}
                    onSave={(permissionIds) => {
                        updateRolePermsMutation.mutate(
                            { roleId: selectedRoleForPerms()!.id, permissionIds },
                            {
                                onSuccess: () => { setShowPermissionModal(false); toast.success('Permisos actualizados'); },
                                onError: (err) => toast.error(`Error: ${err.message}`),
                            }
                        );
                    }}
                    isPending={updateRolePermsMutation.isPending}
                />
            </Show>

            <Show when={showUserRoleModal() && selectedUser()}>
                <UserRoleModal
                    user={selectedUser()!}
                    allRoles={roles()}
                    onClose={() => setShowUserRoleModal(false)}
                    onSave={(roleIds) => {
                        assignUserRolesMutation.mutate(
                            { userId: selectedUser()!.id, roleIds },
                            {
                                onSuccess: () => { setShowUserRoleModal(false); toast.success('Roles asignados'); },
                                onError: (err) => toast.error(`Error: ${err.message}`),
                            }
                        );
                    }}
                    isPending={assignUserRolesMutation.isPending}
                />
            </Show>

            <Show when={showRoleUsersModal() && selectedRoleForUsers()}>
                <RoleUsersModal
                    role={selectedRoleForUsers()!}
                    onClose={() => setShowRoleUsersModal(false)}
                    onRemoveUser={(userId) => {
                        removeUserFromRoleMutation.mutate(
                            { roleId: selectedRoleForUsers()!.id, userId },
                            {
                                onSuccess: () => toast.success('Usuario removido del rol'),
                                onError: (err) => toast.error(`Error: ${err.message}`),
                            }
                        );
                    }}
                    isPending={removeUserFromRoleMutation.isPending}
                />
            </Show>

            <Show when={showUserEditModal() && editingUser()}>
                <UserEditModal
                    user={editingUser()!}
                    onClose={() => setShowUserEditModal(false)}
                    onSave={(data) => {
                        updateUserMutation.mutate(
                            { id: editingUser()!.id, ...data },
                            {
                                onSuccess: () => { setShowUserEditModal(false); toast.success('Usuario actualizado'); },
                                onError: (err) => toast.error(`Error: ${err.message}`),
                            }
                        );
                    }}
                    isPending={updateUserMutation.isPending}
                />
            </Show>
        </div>
    );
};

// ============================================
// ROLE CARD COMPONENT
// ============================================
const RoleCard: Component<{
    role: Role;
    onManagePermissions: () => void;
    onViewUsers: () => void;
    onEdit: () => void;
    onDelete: () => void;
}> = (props) => {
    const bgColor = () => {
        if (props.role.name === 'superadmin') return 'var(--color-danger-bg)';
        if (props.role.name === 'admin') return 'var(--color-warning-bg)';
        return 'var(--color-info-bg)';
    };

    const textColor = () => {
        if (props.role.name === 'superadmin') return 'var(--color-danger-text)';
        if (props.role.name === 'admin') return 'var(--color-warning-text)';
        return 'var(--color-info-text)';
    };

    return (
        <div class="bg-card border border-border shadow-card-soft rounded-xl p-5 hover:shadow-lg transition-shadow">
            <div class="flex items-start justify-between mb-3">
                <div>
                    <h3 class="font-semibold text-lg">{props.role.name}</h3>
                    <p class="text-muted text-sm mt-1">{props.role.description || 'Sin descripción'}</p>
                </div>
                <div class="w-10 h-10 rounded-lg flex items-center justify-center" style={{ background: bgColor() }}>
                    <svg class="w-5 h-5" style={{ color: textColor() }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                    </svg>
                </div>
            </div>

            {/* Clickable user count */}
            <button
                onClick={props.onViewUsers}
                class="flex items-center gap-2 text-sm text-muted mb-4 hover:text-primary transition-colors cursor-pointer"
            >
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
                <span class="underline-offset-2 hover:underline">
                    {props.role.userCount} usuario{props.role.userCount !== 1 ? 's' : ''}
                </span>
            </button>

            <div class="flex gap-2">
                <button onClick={props.onManagePermissions} class="btn btn-ghost text-sm flex-1">
                    <KeyIcon class='size-4' /> Permisos
                </button>
                <Show when={props.role.name !== 'superadmin' && props.role.name !== 'admin'}>
                    <button onClick={props.onEdit} class="btn btn-ghost p-2" title="Editar"><EditIcon /></button>
                    <button onClick={props.onDelete} class="btn btn-ghost p-2 text-error hover:bg-error/10" title="Eliminar"><TrashIcon class='size-4' /></button>
                </Show>
            </div>
        </div>
    );
};

// ============================================
// MODALS
// ============================================

const RoleFormModal: Component<{
    role: Role | null;
    onClose: () => void;
    onSave: (data: { name: string; description?: string }) => void;
    isPending: boolean;
}> = (props) => {
    const [name, setName] = createSignal(props.role?.name ?? '');
    const [description, setDescription] = createSignal(props.role?.description ?? '');

    return (
        <Portal>
            <div class="fixed inset-0 z-50 flex items-center justify-center p-4">
                <div class="fixed inset-0 bg-black/50 backdrop-blur-sm" onClick={props.onClose} />
                <div class="relative bg-card border border-border shadow-card-soft rounded-2xl p-6 w-full max-w-md animate-in fade-in zoom-in-95 duration-200">
                    <h2 class="text-xl font-bold mb-4">{props.role ? 'Editar Rol' : 'Nuevo Rol'}</h2>
                    <form onSubmit={(e) => { e.preventDefault(); props.onSave({ name: name(), description: description() || undefined }); }}>
                        <div class="space-y-4">
                            <div>
                                <label class="block text-sm font-medium text-muted mb-1">Nombre</label>
                                <input type="text" value={name()} onInput={(e) => setName(e.currentTarget.value)} class="input-field w-full" required minLength={2} />
                            </div>
                            <div>
                                <label class="block text-sm font-medium text-muted mb-1">Descripción</label>
                                <textarea value={description()} onInput={(e) => setDescription(e.currentTarget.value)} class="input-field w-full resize-none" rows={3} />
                            </div>
                        </div>
                        <div class="flex gap-3 mt-6">
                            <button type="button" onClick={props.onClose} class="btn btn-ghost flex-1">Cancelar</button>
                            <button type="submit" class="btn btn-primary flex-1" disabled={props.isPending}>{props.isPending ? 'Guardando...' : 'Guardar'}</button>
                        </div>
                    </form>
                </div>
            </div>
        </Portal>
    );
};

const UserFormModal: Component<{
    roles: Role[];
    onClose: () => void;
    onSave: (data: { username: string; email: string; password: string; roleIds?: number[] }) => void;
    isPending: boolean;
}> = (props) => {
    const [username, setUsername] = createSignal('');
    const [email, setEmail] = createSignal('');
    const [password, setPassword] = createSignal('');
    const [selectedRoles, setSelectedRoles] = createSignal<Set<number>>(new Set<number>());

    const toggleRole = (roleId: number) => {
        const newSet = new Set<number>(selectedRoles());
        if (newSet.has(roleId)) { newSet.delete(roleId); } else { newSet.add(roleId); }
        setSelectedRoles(newSet);
    };

    return (
        <Portal>
            <div class="fixed inset-0 z-50 flex items-center justify-center p-4">
                <div class="fixed inset-0 bg-black/50 backdrop-blur-sm" onClick={props.onClose} />
                <div class="relative bg-card border border-border shadow-card-soft rounded-2xl p-6 w-full max-w-lg animate-in fade-in zoom-in-95 duration-200">
                    <h2 class="text-xl font-bold mb-4">Nuevo Usuario</h2>
                    <form onSubmit={(e) => {
                        e.preventDefault();
                        props.onSave({ username: username(), email: email(), password: password(), roleIds: selectedRoles().size > 0 ? Array.from(selectedRoles()) : undefined });
                    }}>
                        <div class="space-y-4">
                            <div class="grid grid-cols-2 gap-4">
                                <div>
                                    <label class="block text-sm font-medium text-muted mb-1">Usuario</label>
                                    <input type="text" value={username()} onInput={(e) => setUsername(e.currentTarget.value)} class="input-field w-full" required minLength={2} />
                                </div>
                                <div>
                                    <label class="block text-sm font-medium text-muted mb-1">Email</label>
                                    <input type="email" value={email()} onInput={(e) => setEmail(e.currentTarget.value)} class="input-field w-full" required />
                                </div>
                            </div>
                            <div>
                                <label class="block text-sm font-medium text-muted mb-1">Contraseña</label>
                                <input type="password" value={password()} onInput={(e) => setPassword(e.currentTarget.value)} class="input-field w-full" required minLength={8} placeholder="Mínimo 8 caracteres" />
                            </div>
                            <div>
                                <label class="block text-sm font-medium text-muted mb-2">Roles</label>
                                <div class="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto">
                                    <For each={props.roles}>
                                        {(role) => (
                                            <label class={`flex items-center gap-2 p-2 rounded-lg cursor-pointer transition-colors ${selectedRoles().has(role.id) ? 'bg-primary/10' : 'hover:bg-surface/50'}`}>
                                                <Checkbox checked={selectedRoles().has(role.id)} onChange={() => toggleRole(role.id)} />
                                                <span class="text-sm ">{role.name}</span>
                                            </label>
                                        )}
                                    </For>
                                </div>
                            </div>
                        </div>
                        <div class="flex gap-3 mt-6">
                            <button type="button" onClick={props.onClose} class="btn btn-ghost flex-1">Cancelar</button>
                            <button type="submit" class="btn btn-primary flex-1" disabled={props.isPending}>{props.isPending ? 'Creando...' : 'Crear Usuario'}</button>
                        </div>
                    </form>
                </div>
            </div>
        </Portal>
    );
};

const PermissionAssignModal: Component<{
    role: Role;
    allPermissions: Permission[];
    groupedPermissions: Record<string, Permission[]>;
    onClose: () => void;
    onSave: (permissionIds: number[]) => void;
    isPending: boolean;
}> = (props) => {
    const rolePermsQuery = useRolePermissions(() => props.role.id);
    const [selectedIds, setSelectedIds] = createSignal<Set<number>>(new Set<number>());
    const [expandedModules, setExpandedModules] = createSignal<Set<string>>(new Set<string>());
    const [permSearch, setPermSearch] = createSignal('');

    // Filter grouped permissions by search
    const filteredGrouped = createMemo(() => {
        const term = permSearch().toLowerCase();
        if (!term) return props.groupedPermissions;
        const result: Record<string, Permission[]> = {};
        for (const [module, perms] of Object.entries(props.groupedPermissions)) {
            const filtered = perms.filter(p =>
                p.slug.toLowerCase().includes(term) ||
                p.description?.toLowerCase().includes(term) ||
                (moduleLabels[module] || module).toLowerCase().includes(term)
            );
            if (filtered.length > 0) result[module] = filtered;
        }
        return result;
    });

    createEffect(() => {
        if (rolePermsQuery.data) {
            setSelectedIds(new Set<number>(rolePermsQuery.data.map(p => p.id)));
        }
    });

    const togglePermission = (id: number) => {
        const newSet = new Set<number>(selectedIds());
        if (newSet.has(id)) { newSet.delete(id); } else { newSet.add(id); }
        setSelectedIds(newSet);
    };

    const toggleModule = (module: string) => {
        const modulePerms = props.groupedPermissions[module] ?? [];
        const moduleIds = modulePerms.map(p => p.id);
        const allSelected = moduleIds.every(id => selectedIds().has(id));
        const newSet = new Set<number>(selectedIds());
        if (allSelected) { moduleIds.forEach(id => newSet.delete(id)); } else { moduleIds.forEach(id => newSet.add(id)); }
        setSelectedIds(newSet);
    };

    const toggleExpand = (module: string) => {
        const newSet = new Set<string>(expandedModules());
        if (newSet.has(module)) { newSet.delete(module); } else { newSet.add(module); }
        setExpandedModules(newSet);
    };

    const isModuleSelected = (module: string) => {
        const modulePerms = props.groupedPermissions[module] ?? [];
        return modulePerms.length > 0 && modulePerms.every(p => selectedIds().has(p.id));
    };

    const isModulePartial = (module: string) => {
        const modulePerms = props.groupedPermissions[module] ?? [];
        const selected = modulePerms.filter(p => selectedIds().has(p.id)).length;
        return selected > 0 && selected < modulePerms.length;
    };

    const toggleAll = () => {
        if (selectedIds().size === props.allPermissions.length) {
            setSelectedIds(new Set<number>());
        } else {
            setSelectedIds(new Set<number>(props.allPermissions.map(p => p.id)));
        }
    };

    const expandAll = () => setExpandedModules(new Set<string>(Object.keys(props.groupedPermissions)));
    const collapseAll = () => setExpandedModules(new Set<string>());

    return (
        <Portal>
            <div class="fixed inset-0 z-50 flex items-center justify-center p-4">
                <div class="fixed inset-0 bg-black/50 backdrop-blur-sm" onClick={props.onClose} />
                <div class="relative bg-card border border-border shadow-card-soft rounded-2xl p-6 w-full max-w-4xl max-h-[85vh] flex flex-col animate-in fade-in zoom-in-95 duration-200">
                    <div class="flex items-center justify-between mb-4">
                        <h2 class="text-xl font-bold">Permisos para: <span style={{ color: 'var(--color-primary)' }}>{props.role.name}</span></h2>
                        <div class="flex items-center gap-2">
                            <button onClick={expandAll} class="btn btn-ghost text-xs">Expandir</button>
                            <button onClick={collapseAll} class="btn btn-ghost text-xs">Colapsar</button>
                            <button onClick={toggleAll} class="btn btn-ghost text-sm">{selectedIds().size === props.allPermissions.length ? 'Quitar todos' : 'Seleccionar todos'}</button>
                        </div>
                    </div>

                    <SearchInput value={permSearch()} onSearch={setPermSearch} placeholder="Buscar permisos..." class="mb-4" />

                    <div class="flex-1 overflow-y-auto pr-2">
                        <Show when={!rolePermsQuery.isLoading} fallback={<SkeletonLoader type="card" count={4} />}>
                            <div class="grid grid-cols-1 md:grid-cols-2 gap-3" style={{ 'align-items': 'start' }}>
                                <For each={Object.entries(filteredGrouped())}>
                                    {([module, perms]) => (
                                        <div class="bg-card border border-border shadow-card-soft rounded-lg overflow-hidden">
                                            <div class="flex items-center justify-between p-3 cursor-pointer hover:bg-surface/50 transition-colors" onClick={() => toggleExpand(module)}>
                                                <div class="flex items-center gap-3">
                                                    <Checkbox
                                                        checked={isModuleSelected(module)}
                                                        indeterminate={isModulePartial(module)}

                                                        /* CAMBIO 1: onChange ahora recibe el valor (boolean), no el evento.
                                                           Ya no necesitamos detener propagación aquí. */
                                                        onChange={(isChecked) => toggleModule(module)}

                                                        /* CAMBIO 2: Detenemos la propagación en el evento nativo onClick.
                                                           Esto evita que el clic "suba" al contenedor padre (ej. si está en una tarjeta o fila). */
                                                        onClick={(e: MouseEvent) => e.stopPropagation()}
                                                    />
                                                    <span class="font-medium ">{moduleLabels[module] || module}</span>
                                                    <span class="text-xs text-muted">({perms.length})</span>
                                                </div>
                                                <svg class={`w-4 h-4 text-muted transition-transform ${expandedModules().has(module) ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
                                                </svg>
                                            </div>
                                            <Show when={expandedModules().has(module)}>
                                                <div class="px-3 pb-3 space-y-1 border-t border-border pt-2">
                                                    <For each={perms}>
                                                        {(perm) => {
                                                            const action = perm.slug.split('.')[1];
                                                            return (
                                                                <label class={`flex items-center gap-2 p-2 rounded cursor-pointer transition-colors ${selectedIds().has(perm.id) ? 'bg-primary/5' : 'hover:bg-surface/30'}`}>
                                                                    <Checkbox
                                                                        checked={selectedIds().has(perm.id)}
                                                                        onChange={() => togglePermission(perm.id)}
                                                                        onClick={(e: MouseEvent) => e.stopPropagation()}
                                                                    />
                                                                    <ActionBadge action={action} />
                                                                    <span class="text-sm text-muted truncate">{perm.description}</span>
                                                                </label>
                                                            );
                                                        }}
                                                    </For>
                                                </div>
                                            </Show>
                                        </div>
                                    )}
                                </For>
                            </div>
                        </Show>
                    </div>

                    <div class="flex gap-3 mt-4 pt-4 border-t border-border">
                        <span class="text-sm text-muted self-center">{selectedIds().size} de {props.allPermissions.length}</span>
                        <div class="flex-1" />
                        <button type="button" onClick={props.onClose} class="btn btn-ghost">Cancelar</button>
                        <button onClick={() => props.onSave(Array.from(selectedIds()))} class="btn btn-primary" disabled={props.isPending}>{props.isPending ? 'Guardando...' : 'Guardar'}</button>
                    </div>
                </div>
            </div>
        </Portal>
    );
};

const UserRoleModal: Component<{
    user: UserWithRoles;
    allRoles: Role[];
    onClose: () => void;
    onSave: (roleIds: number[]) => void;
    isPending: boolean;
}> = (props) => {
    const [selectedRoles, setSelectedRoles] = createSignal<Set<number>>(new Set<number>(props.user.roles.map(r => r.id)));

    const toggleRole = (roleId: number) => {
        const newSet = new Set<number>(selectedRoles());
        if (newSet.has(roleId)) { newSet.delete(roleId); } else { newSet.add(roleId); }
        setSelectedRoles(newSet);
    };

    return (
        <Portal>
            <div class="fixed inset-0 z-50 flex items-center justify-center p-4">
                <div class="fixed inset-0 bg-black/50 backdrop-blur-sm" onClick={props.onClose} />
                <div class="relative bg-card border border-border shadow-card-soft rounded-2xl p-6 w-full max-w-md animate-in fade-in zoom-in-95 duration-200">
                    <h2 class="text-xl font-bold mb-2">Roles para: <span style={{ color: 'var(--color-primary)' }}>{props.user.username}</span></h2>
                    <p class="text-muted text-sm mb-4">{props.user.email}</p>
                    <div class="space-y-2 max-h-64 overflow-y-auto">
                        <For each={props.allRoles}>
                            {(role) => (
                                <label class={`flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-colors ${selectedRoles().has(role.id) ? 'bg-primary/10' : 'hover:bg-surface/50'}`}>
                                    <Checkbox checked={selectedRoles().has(role.id)} onChange={() => toggleRole(role.id)} />
                                    <div class="flex-1">
                                        <p class="font-medium">{role.name}</p>
                                        <p class="text-xs text-muted">{role.description || 'Sin descripción'}</p>
                                    </div>
                                </label>
                            )}
                        </For>
                    </div>
                    <div class="flex gap-3 mt-6">
                        <button type="button" onClick={props.onClose} class="btn btn-ghost flex-1">Cancelar</button>
                        <button onClick={() => props.onSave(Array.from(selectedRoles()))} class="btn btn-primary flex-1" disabled={props.isPending}>{props.isPending ? 'Guardando...' : 'Guardar'}</button>
                    </div>
                </div>
            </div>
        </Portal>
    );
};

// ============================================
// ROLE USERS MODAL
// ============================================
const RoleUsersModal: Component<{
    role: Role;
    onClose: () => void;
    onRemoveUser: (userId: number) => void;
    isPending: boolean;
}> = (props) => {
    const roleUsersQuery = useRoleUsers(() => props.role.id);
    const [searchTerm, setSearchTerm] = createSignal('');

    const filteredUsers = createMemo(() => {
        const term = searchTerm().toLowerCase();
        const users = roleUsersQuery.data ?? [];
        if (!term) return users;
        return users.filter(u =>
            u.username.toLowerCase().includes(term) ||
            u.email.toLowerCase().includes(term)
        );
    });

    return (
        <Portal>
            <div class="fixed inset-0 z-50 flex items-center justify-center p-4">
                <div class="fixed inset-0 bg-black/50 backdrop-blur-sm" onClick={props.onClose} />
                <div class="relative bg-card border border-border shadow-card-soft rounded-2xl p-6 w-full max-w-lg animate-in fade-in zoom-in-95 duration-200">
                    <div class="flex items-center justify-between mb-4">
                        <div>
                            <h2 class="text-xl font-bold">
                                Usuarios con rol: <span style={{ color: 'var(--color-primary)' }}>{props.role.name}</span>
                            </h2>
                            <p class="text-muted text-sm">{props.role.description || 'Sin descripción'}</p>
                        </div>
                        <button onClick={props.onClose} class="p-2 rounded-lg hover:bg-surface/50 text-muted">
                            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    </div>

                    <SearchInput
                        value={searchTerm()}
                        onSearch={setSearchTerm}
                        placeholder="Buscar usuarios..."
                        class="mb-4"
                    />

                    <div class="space-y-2 max-h-80 overflow-y-auto">
                        <Show when={!roleUsersQuery.isLoading} fallback={<SkeletonLoader type="list-item" count={3} />}>
                            <Show when={filteredUsers().length > 0} fallback={
                                <EmptyState message="Sin usuarios" description="No hay usuarios con este rol" />
                            }>
                                <For each={filteredUsers()}>
                                    {(user) => (
                                        <div class="flex items-center gap-3 p-3 rounded-lg bg-surface/30 group">
                                            <div class="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500/20 to-purple-600/40 flex items-center justify-center ring-1 ring-white/10">
                                                <span class="text-sm font-semibold" style={{ color: 'var(--color-primary)' }}>
                                                    {user.username.slice(0, 2).toUpperCase()}
                                                </span>
                                            </div>
                                            <div class="flex-1 min-w-0">
                                                <p class="font-medium truncate">{user.username}</p>
                                                <p class="text-xs text-muted truncate">{user.email}</p>
                                            </div>
                                            <StatusBadge isActive={user.isActive} />
                                            <button
                                                onClick={() => props.onRemoveUser(user.id)}
                                                disabled={props.isPending}
                                                class="p-2 rounded-lg opacity-0 group-hover:opacity-100 hover:bg-error/10 text-muted hover:text-error transition-all"
                                                title="Quitar rol"
                                            >
                                                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 7a4 4 0 11-8 0 4 4 0 018 0zM9 14a6 6 0 00-6 6v1h12v-1a6 6 0 00-6-6zM21 12h-6" />
                                                </svg>
                                            </button>
                                        </div>
                                    )}
                                </For>
                            </Show>
                        </Show>
                    </div>

                    <div class="flex gap-3 mt-6 pt-4 border-t border-border">
                        <span class="text-sm text-muted self-center">{filteredUsers().length} usuario(s)</span>
                        <div class="flex-1" />
                        <button onClick={props.onClose} class="btn btn-ghost">Cerrar</button>
                    </div>
                </div>
            </div>
        </Portal>
    );
};

// ============================================
// USER EDIT MODAL
// ============================================
const UserEditModal: Component<{
    user: UserWithRoles;
    onClose: () => void;
    onSave: (data: { username?: string; email?: string; isActive?: boolean }) => void;
    isPending: boolean;
}> = (props) => {
    const [username, setUsername] = createSignal(props.user.username);
    const [email, setEmail] = createSignal(props.user.email);
    const [isActive, setIsActive] = createSignal(props.user.isActive ?? true);

    return (
        <Portal>
            <div class="fixed inset-0 z-50 flex items-center justify-center p-4">
                <div class="fixed inset-0 bg-black/50 backdrop-blur-sm" onClick={props.onClose} />
                <div class="relative bg-card border border-border shadow-card-soft rounded-2xl p-6 w-full max-w-md animate-in fade-in zoom-in-95 duration-200">
                    <h2 class="text-xl font-bold mb-4">Editar Usuario</h2>
                    <form onSubmit={(e) => {
                        e.preventDefault();
                        props.onSave({
                            username: username() !== props.user.username ? username() : undefined,
                            email: email() !== props.user.email ? email() : undefined,
                            isActive: isActive() !== props.user.isActive ? isActive() : undefined,
                        });
                    }}>
                        <div class="space-y-4">
                            <Input
                                id="edit-username"
                                label="Nombre de Usuario"
                                type="text"
                                value={username()}
                                onInput={(e) => setUsername(e.currentTarget.value)}
                                required
                                minLength={2}
                            />
                            <Input
                                id="edit-email"
                                label="Email"
                                type="email"
                                value={email()}
                                onInput={(e) => setEmail(e.currentTarget.value)}
                                required
                            />
                            <div class="flex items-center gap-3 p-3 rounded-lg bg-surface/30">
                                <Checkbox
                                    checked={isActive()}
                                    /* Al recibir el valor directo, pasamos el setter directamente */
                                    onChange={setIsActive}
                                    id="edit-active"
                                />
                                <label for="edit-active" class="flex-1 cursor-pointer">
                                    <p class="font-medium">Estado Activo</p>
                                    <p class="text-xs text-muted">El usuario puede iniciar sesión</p>
                                </label>
                            </div>
                        </div>
                        <div class="flex gap-3 mt-6">
                            <button type="button" onClick={props.onClose} class="btn btn-ghost flex-1">Cancelar</button>
                            <button type="submit" class="btn btn-primary flex-1" disabled={props.isPending}>
                                {props.isPending ? 'Guardando...' : 'Guardar'}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </Portal>
    );
};

export default UsersRolesPage;
