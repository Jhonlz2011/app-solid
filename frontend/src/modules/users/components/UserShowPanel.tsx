import { Component, For, Show, createSignal } from 'solid-js';
import { useNavigate } from '@tanstack/solid-router';
import { toast } from 'solid-sonner';
import { UAParser } from 'ua-parser-js';
import type { AuditLogEntry } from '../models/users.types';
import Sheet from '@shared/ui/Sheet';
import Button from '@shared/ui/Button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@shared/ui/Tabs';
import { SkeletonLoader, ListItemSkeleton } from '@shared/ui/SkeletonLoader';
import { Avatar } from '@shared/ui/Avatar';
import { StatusBadge, RoleBadge } from '@shared/ui/Badge';
import { TextField } from '@shared/ui/TextField';
import ErrorState from '@shared/ui/ErrorState';
import ConfirmDialog from '@shared/ui/ConfirmDialog';
import { EditIcon, KeyIcon, InfoIcon, DeviceIcon, LogoutIcon, EyeIcon, EyeOffIcon, CopyIcon, UserHistoryIcon } from '@shared/ui/icons';
import { useAuth } from '@modules/auth/store/auth.store';
import {
    useUser,
    useUserSessions,
    useRevokeUserSession,
    useAdminResetPassword,
    useUserAuditLog,
} from '../data/users.queries';

interface UserShowPanelProps {
    userId: number;
}

// ─── Utilities ───────────────────────────────────────────────────────────────

const parseUserAgent = (ua: string | null): { browser: string; os: string; icon: string } => {
    if (!ua) return { browser: 'Desconocido', os: 'Desconocido', icon: 'M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z' };
    const parser = new UAParser(ua);
    const result = parser.getResult();
    let osName = result.os.name || 'Desconocido';
    const vendor = result.device.vendor;
    const model = result.device.model;
    let displayName = osName;
    if (vendor && model) displayName = `${vendor} ${model}`;
    else if (model && model.length > 2) displayName = model;
    let icon = 'M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z';
    if (result.device.type === 'mobile' || result.device.type === 'tablet' || osName === 'Android' || osName === 'iOS') {
        icon = 'M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z';
    }
    return { browser: result.browser.name || 'Navegador', os: displayName, icon };
};

const formatDate = (dateStr: string): string => {
    return new Date(dateStr).toLocaleDateString('es-EC', {
        day: 'numeric', month: 'short', year: 'numeric',
        hour: '2-digit', minute: '2-digit',
    });
};

// const formatRelative = (dateStr: string): string => {
//     const diff = Date.now() - new Date(dateStr).getTime();
//     const mins = Math.floor(diff / 60000);
//     if (mins < 1) return 'Ahora';
//     if (mins < 60) return `hace ${mins}m`;
//     const hours = Math.floor(mins / 60);
//     if (hours < 24) return `hace ${hours}h`;
//     const days = Math.floor(hours / 24);
//     if (days < 30) return `hace ${days}d`;
//     return formatDate(dateStr);
// };


const generatePassword = (length = 16): string => {
    const chars = 'abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789!@#$%&*';
    return Array.from({ length }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
};

// ─── Main Component ──────────────────────────────────────────────────────────

const UserShowPanel: Component<UserShowPanelProps> = (props) => {
    const navigate = useNavigate();
    const auth = useAuth();
    const userQuery = useUser(() => props.userId);

    const handleClose = () => navigate({ to: '/users' });
    const handleEdit = () => navigate({ to: `/users/edit/${props.userId}` });

    const canUpdate = () => auth.canEdit?.('users') ?? false;

    const InfoRow = (rowProps: { label: string; value?: string | number | boolean | null }) => {
        const displayValue = () => {
            if (rowProps.value === null || rowProps.value === undefined || rowProps.value === '') return '—';
            if (typeof rowProps.value === 'boolean') return rowProps.value ? 'Sí' : 'No';
            return String(rowProps.value);
        };
        return (
            <div class="flex flex-col gap-1">
                <span class="text-xs font-medium text-muted uppercase tracking-wider">{rowProps.label}</span>
                <span class="text-sm text-text font-medium">{displayValue()}</span>
            </div>
        );
    };

    return (
        <Sheet
            isOpen={true}
            onClose={handleClose}
            title="Detalle de Usuario"
            description="Información completa de la cuenta"
            size="xl"
            footer={
                <Button variant="outline" onClick={handleClose}>Cerrar</Button>
            }
        >
            <Show
                when={!userQuery.isLoading}
                fallback={
                    <div class="space-y-6 py-4">
                        <div class="flex items-center gap-4">
                            <SkeletonLoader type="avatar" class="size-14" />
                            <div class="space-y-2">
                                <SkeletonLoader type="text" class="w-40 h-5" />
                                <SkeletonLoader type="text" class="w-56 h-4" />
                            </div>
                        </div>
                        <SkeletonLoader type="text" count={4} />
                    </div>
                }
            >
                <Show
                    when={userQuery.data}
                    fallback={
                        <div class="flex flex-col items-center justify-center py-16 text-center">
                            <div class="text-4xl mb-4 opacity-30">📭</div>
                            <p class="text-muted">No se encontró el usuario</p>
                        </div>
                    }
                >
                    {(user) => (
                        <Tabs defaultValue="general" class="w-full flex flex-col h-full">
                            <div class="sticky top-0 z-20 bg-card/95 backdrop-blur-md pt-5 pb-3 border-b border-border/40 flex flex-col gap-5 px-1 -mx-1">
                                {/* Header */}
                                <div class="flex items-start justify-between flex-shrink-0">
                                    <div class="flex items-center gap-4">
                                        <Avatar name={user().username} size="lg" />
                                        <div class="flex flex-col gap-1">
                                            <h3 class="text-xl font-bold text-text leading-tight">{user().username}</h3>
                                            <p class="text-sm text-muted font-medium">{user().email}</p>
                                            <div class="mt-1.5 flex items-center gap-2">
                                                <StatusBadge isActive={user().isActive ?? true} />
                                            </div>
                                        </div>
                                    </div>
                                    <Button variant="outline" size="sm" onClick={handleEdit} class="gap-2 shrink-0 bg-surface/50 hover:bg-surface">
                                        <EditIcon class="size-4 text-muted" />
                                        Editar
                                    </Button>
                                </div>

                                {/* TabsList */}
                                <div>
                                    <TabsList class="flex py-1.5 overflow-x-auto shadow-sm rounded-xl">
                                        <TabsTrigger value="general"><InfoIcon class="size-4" /> General</TabsTrigger>
                                        <TabsTrigger value="sessions"><DeviceIcon class="size-4" /> Sesiones</TabsTrigger>
                                        <TabsTrigger value="activity"><UserHistoryIcon class="size-4" /> Actividad</TabsTrigger>
                                    </TabsList>
                                </div>
                            </div>

                            {/* Scrollable Content Area */}
                            <div class="flex-1 px-1 pb-6 pt-5">
                                {/* ═══ General Tab ═══ */}
                                <TabsContent value="general" class="space-y-4 animate-in fade-in duration-200">
                                    {/* Account Info */}
                                    <div class="bg-surface/30 rounded-2xl border border-border/40 overflow-hidden">
                                        <div class="bg-surface/50 px-5 py-3 border-b border-border/40 font-semibold text-sm text-text flex items-center gap-2">
                                            <div class="size-1.5 rounded-full bg-primary" />
                                            Datos de la cuenta
                                        </div>
                                        <div class="p-5 grid grid-cols-1 sm:grid-cols-2 gap-6">
                                            <InfoRow label="Usuario" value={user().username} />
                                            <InfoRow label="Correo electrónico" value={user().email} />
                                            <InfoRow label="Estado" value={user().isActive ? 'Activo' : 'Inactivo'} />
                                            <InfoRow
                                                label="Último acceso"
                                                value={
                                                    user().lastLogin
                                                        ? new Date(user().lastLogin!).toLocaleString('es-EC')
                                                        : 'Nunca'
                                                }
                                            />
                                        </div>
                                    </div>

                                    {/* Entity Link */}
                                    <Show when={user().entity}>
                                        {(entity) => (
                                            <div class="bg-surface/30 rounded-2xl border border-border/40 overflow-hidden">
                                                <div class="bg-surface/50 px-5 py-3 border-b border-border/40 font-semibold text-sm text-text flex items-center gap-2">
                                                    <div class="size-1.5 rounded-full bg-info" />
                                                    Persona vinculada
                                                </div>
                                                <div class="p-5">
                                                    <div class="flex items-center gap-3">
                                                        <div class="size-10 rounded-xl bg-info/10 flex items-center justify-center shrink-0">
                                                            <InfoIcon class="size-5 text-info" />
                                                        </div>
                                                        <div class="min-w-0 flex-1">
                                                            <p class="font-semibold text-text truncate">{entity().businessName}</p>
                                                            <p class="text-xs text-muted">{entity().taxId}</p>
                                                            <div class="flex gap-1.5 mt-1">
                                                                <Show when={entity().isEmployee}>
                                                                    <span class="text-[10px] px-1.5 py-0.5 rounded bg-primary/10 text-primary">Empleado</span>
                                                                </Show>
                                                                <Show when={entity().isClient}>
                                                                    <span class="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-600">Cliente</span>
                                                                </Show>
                                                                <Show when={entity().isSupplier}>
                                                                    <span class="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-600">Proveedor</span>
                                                                </Show>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                    </Show>

                                    {/* Roles */}
                                    <div class="bg-surface/30 rounded-2xl border border-border/40 overflow-hidden">
                                        <div class="bg-surface/50 px-5 py-3 border-b border-border/40 font-semibold text-sm text-text flex items-center gap-2">
                                            <div class="size-1.5 rounded-full bg-violet-500" />
                                            Roles asignados
                                            <Show when={(user().roles?.length ?? 0) > 0}>
                                                <span class="ml-auto text-xs px-2 py-0.5 rounded-full bg-violet-500/10 text-violet-600 font-bold">
                                                    {user().roles?.length}
                                                </span>
                                            </Show>
                                        </div>
                                        <Show
                                            when={(user().roles?.length ?? 0) > 0}
                                            fallback={
                                                <div class="flex flex-col items-center justify-center py-8 text-center">
                                                    <KeyIcon class="size-7 opacity-20 mb-2" />
                                                    <p class="text-muted text-sm">Sin roles asignados</p>
                                                </div>
                                            }
                                        >
                                            <div class="p-3 space-y-2">
                                                <For each={user().roles}>
                                                    {(role) => (
                                                        <div class="flex items-center gap-3 p-3 bg-card rounded-xl border border-border/40 hover:bg-surface/40 transition-colors">
                                                            <div class="size-9 rounded-xl bg-primary/10 flex items-center justify-center">
                                                                <KeyIcon class="size-4 text-primary" />
                                                            </div>
                                                            <div class="flex-1 min-w-0">
                                                                <RoleBadge name={role.name} />
                                                                <Show when={role.description}>
                                                                    <p class="text-xs text-muted mt-1 truncate">{role.description}</p>
                                                                </Show>
                                                            </div>
                                                        </div>
                                                    )}
                                                </For>
                                            </div>
                                        </Show>
                                    </div>

                                    {/* Security — Password Reset */}
                                    <Show when={canUpdate()}>
                                        <PasswordResetSection userId={props.userId} username={user().username} />
                                    </Show>
                                </TabsContent>

                                {/* ═══ Sessions Tab ═══ */}
                                <TabsContent value="sessions" class="animate-in fade-in duration-200">
                                    <UserSessionsTab userId={props.userId} />
                                </TabsContent>

                                <TabsContent value="activity" class="animate-in fade-in duration-200">
                                    <UserActivityTab userId={props.userId} />
                                </TabsContent>
                            </Tabs>
                        )}
                </Show>
            </Show>
        </Sheet>
    );
};

// ─── Sessions Sub-Component ──────────────────────────────────────────────────

const UserSessionsTab: Component<{ userId: number }> = (props) => {
    const sessionsQuery = useUserSessions(() => props.userId);
    const revokeMutation = useRevokeUserSession();
    const [revoking, setRevoking] = createSignal<string | null>(null);
    const [confirmRevoke, setConfirmRevoke] = createSignal<string | null>(null);

    const sessions = () => sessionsQuery.data ?? [];
    const isLoading = () => sessionsQuery.isLoading;

    const handleRevoke = async (sessionId: string) => {
        setRevoking(sessionId);
        setConfirmRevoke(null);
        try {
            await revokeMutation.mutateAsync({ userId: props.userId, sessionId });
            toast.success('Sesión revocada correctamente');
        } catch {
            toast.error('No se pudo revocar la sesión');
        } finally {
            setRevoking(null);
        }
    };

    return (
        <div>
            <div class="flex items-center justify-between mb-4">
                <div>
                    <h3 class="text-sm font-semibold text-text">Sesiones activas</h3>
                    <p class="text-xs text-muted mt-0.5">Dispositivos donde este usuario ha iniciado sesión</p>
                </div>
                <Show when={sessions().length > 0}>
                    <span class="px-2.5 py-1 text-xs font-bold rounded-full bg-primary/10 text-primary">
                        {sessions().length} activas
                    </span>
                </Show>
            </div>

            <Show when={isLoading()}>
                <div class="space-y-3">
                    <For each={[0, 1]}>{() => <ListItemSkeleton />}</For>
                </div>
            </Show>

            <Show when={sessionsQuery.isError && !sessionsQuery.data}>
                <ErrorState size="sm" description="Error al cargar las sesiones" onRetry={() => sessionsQuery.refetch()} />
            </Show>

            <Show when={!isLoading() && sessions().length === 0 && !sessionsQuery.isError}>
                <div class="text-center py-10 bg-surface/30 rounded-2xl border border-dashed border-border/60">
                    <DeviceIcon class="size-8 mx-auto mb-3 opacity-20" />
                    <p class="text-muted text-sm">No hay sesiones activas</p>
                </div>
            </Show>

            <Show when={sessions().length > 0}>
                <div class="space-y-2.5">
                    <For each={sessions()}>
                        {(session) => {
                            const { browser, os, icon } = parseUserAgent(session.user_agent);
                            return (
                                <div
                                    classList={{
                                        'rounded-xl p-4 border transition-colors': true,
                                        'border-primary/30 bg-primary/5 ring-1 ring-primary/20': session.is_current,
                                        'border-border/40 bg-surface/30 hover:border-border': !session.is_current,
                                    }}
                                >
                                    <div class="flex items-center justify-between gap-3">
                                        <div class="flex items-center gap-3 min-w-0 flex-1">
                                            <div classList={{
                                                'size-10 rounded-xl flex items-center justify-center shrink-0 transition-colors': true,
                                                'bg-primary text-white shadow-lg shadow-primary/20': session.is_current,
                                                'bg-surface-alt text-muted': !session.is_current,
                                            }}>
                                                <svg class="size-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d={icon} />
                                                </svg>
                                            </div>
                                            <div class="min-w-0 flex-1">
                                                <div class="flex items-center gap-2">
                                                    <span class="font-semibold text-text text-sm truncate">{os}</span>
                                                    <Show when={session.is_current}>
                                                        <span class="text-[10px] uppercase tracking-wider bg-primary text-white px-2 py-0.5 rounded-full font-bold shrink-0">
                                                            Actual
                                                        </span>
                                                    </Show>
                                                </div>
                                                <div class="text-xs text-muted mt-0.5 flex items-center gap-1.5">
                                                    <span>{browser}</span>
                                                    <span class="size-1 rounded-full bg-border" />
                                                    <span class="truncate">
                                                        {session.location ? `${session.location} · ` : ''}
                                                        {session.ip_address || 'IP desconocida'}
                                                    </span>
                                                </div>
                                                <div class="text-[11px] text-muted/60 mt-0.5">
                                                    Iniciada {formatDate(session.created_at)}
                                                </div>
                                            </div>
                                        </div>
                                        <Show when={!session.is_current}>
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => setConfirmRevoke(session.id)}
                                                disabled={revoking() === session.id}
                                                loading={revoking() === session.id}
                                                class="text-danger hover:text-danger hover:bg-danger/10 shrink-0"
                                                title="Revocar sesión"
                                            >
                                                <Show when={revoking() !== session.id}>
                                                    <LogoutIcon class="size-4" />
                                                </Show>
                                            </Button>
                                        </Show>
                                    </div>
                                </div>
                            );
                        }}
                    </For>
                </div>
            </Show>

            <ConfirmDialog
                isOpen={!!confirmRevoke()}
                onClose={() => setConfirmRevoke(null)}
                onConfirm={() => confirmRevoke() && handleRevoke(confirmRevoke()!)}
                title="¿Revocar sesión?"
                description="El usuario será desconectado de este dispositivo inmediatamente."
                confirmLabel="Revocar"
                variant="warning"
                isLoading={!!revoking()}
                loadingText="Revocando..."
            />
        </div>
    );
};

// ─── Activity Sub-Component ──────────────────────────────────────────────────

const AUDIT_ACTION_LABELS: Record<string, { label: string; color: string }> = {
    INSERT: { label: 'Creado', color: 'bg-emerald-500/15 text-emerald-600' },
    UPDATE: { label: 'Actualizado', color: 'bg-blue-500/15 text-blue-600' },
    DELETE: { label: 'Eliminado', color: 'bg-red-500/15 text-red-600' },
    LOGIN: { label: 'Inicio de sesión', color: 'bg-violet-500/15 text-violet-600' },
    EXPORT: { label: 'Exportado', color: 'bg-amber-500/15 text-amber-600' },
};

const TABLE_NAME_LABELS: Record<string, string> = {
    entities: 'Entidad',
    auth_users: 'Usuario',
    products: 'Producto',
    invoices: 'Factura',
    work_orders: 'Orden de trabajo',
};

const UserActivityTab: Component<{ userId: number }> = (props) => {
    const [page, setPage] = createSignal(1);
    const auditQuery = useUserAuditLog(() => props.userId, page);

    const entries = () => auditQuery.data?.data ?? [];
    const meta = () => auditQuery.data?.meta;
    const isLoading = () => auditQuery.isLoading;

    return (
        <div>
            <div class="flex items-center justify-between mb-4">
                <div>
                    <h3 class="text-sm font-semibold text-text">Registro de actividad</h3>
                    <p class="text-xs text-muted mt-0.5">Acciones realizadas por este usuario</p>
                </div>
                <Show when={meta()}>
                    <span class="text-xs text-muted">
                        {meta()!.total} entradas
                    </span>
                </Show>
            </div>

            <Show when={isLoading() && entries().length === 0}>
                <div class="space-y-3">
                    <For each={[0, 1, 2]}>{() => <ListItemSkeleton />}</For>
                </div>
            </Show>

            <Show when={auditQuery.isError && entries().length === 0}>
                <ErrorState size="sm" description="Error al cargar el historial" onRetry={() => auditQuery.refetch()} />
            </Show>

            <Show when={!isLoading() && entries().length === 0 && !auditQuery.isError}>
                <div class="text-center py-10 bg-surface/30 rounded-2xl border border-dashed border-border/60">
                    <UserHistoryIcon class="size-8 mx-auto mb-3 opacity-20" />
                    <p class="text-muted text-sm">Sin actividad registrada</p>
                </div>
            </Show>

            <Show when={entries().length > 0}>
                {/* Timeline */}
                <div class="relative">
                    {/* Vertical line */}
                    <div class="absolute left-[19px] top-2 bottom-2 w-px bg-border/40" />

                    <div class="space-y-1">
                        <For each={entries()}>
                            {(entry: AuditLogEntry) => {
                                const actionInfo = () => AUDIT_ACTION_LABELS[entry.action] ?? {
                                    label: entry.action,
                                    color: 'bg-gray-500/15 text-gray-600',
                                };
                                const tableName = () => TABLE_NAME_LABELS[entry.tableName] ?? entry.tableName;

                                return (
                                    <div class="relative flex items-start gap-3 py-2.5 pl-1">
                                        {/* Dot */}
                                        <div class="size-[10px] rounded-full bg-card border-2 border-border/60 mt-1.5 shrink-0 z-10" />

                                        {/* Content */}
                                        <div class="flex-1 min-w-0">
                                            <div class="flex items-center gap-2 flex-wrap">
                                                <span class={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${actionInfo().color}`}>
                                                    {actionInfo().label}
                                                </span>
                                                <span class="text-[11px] text-muted/80 font-medium">
                                                    {tableName()}
                                                </span>
                                                <span class="text-[11px] text-muted/50 font-mono">
                                                    #{entry.recordId}
                                                </span>
                                                <span class="text-[11px] text-muted/60" title={formatDate(entry.createdAt)}>
                                                    {formatDate(entry.createdAt)}
                                                </span>
                                            </div>
                                            <Show when={entry.performedByUsername}>
                                                <p class="text-xs text-muted mt-0.5">
                                                    por <span class="font-medium text-text/80">{entry.performedByUsername}</span>
                                                </p>
                                            </Show>
                                            <Show when={entry.ipAddress}>
                                                <p class="text-[11px] text-muted/50 mt-0.5">IP: {entry.ipAddress}</p>
                                            </Show>
                                        </div>
                                    </div>
                                );
                            }}
                        </For>
                    </div>
                </div>

                {/* Pagination */}
                <Show when={meta() && meta()!.pageCount > 1}>
                    <div class="flex items-center justify-between mt-4 pt-4 border-t border-border/40">
                        <Button
                            variant="outline"
                            size="sm"
                            disabled={!meta()!.hasPrevPage || auditQuery.isFetching}
                            onClick={() => setPage(p => Math.max(1, p - 1))}
                        >
                            Anterior
                        </Button>
                        <span class="text-xs text-muted">
                            Página {meta()!.page} de {meta()!.pageCount}
                        </span>
                        <Button
                            variant="outline"
                            size="sm"
                            disabled={!meta()!.hasNextPage || auditQuery.isFetching}
                            onClick={() => setPage(p => p + 1)}
                        >
                            Siguiente
                        </Button>
                    </div>
                </Show>
            </Show>
        </div>
    );
};

// ─── Password Reset Sub-Component ────────────────────────────────────────────

const PasswordResetSection: Component<{ userId: number; username: string }> = (props) => {
    const [newPassword, setNewPassword] = createSignal('');
    const [showPassword, setShowPassword] = createSignal(false);
    const [showConfirm, setShowConfirm] = createSignal(false);
    const resetMutation = useAdminResetPassword();

    const handleGenerate = () => {
        const pw = generatePassword();
        setNewPassword(pw);
        setShowPassword(true);
    };

    const handleCopy = () => {
        navigator.clipboard.writeText(newPassword());
        toast.success('Contraseña copiada al portapapeles');
    };

    const handleReset = async () => {
        setShowConfirm(false);
        try {
            await resetMutation.mutateAsync({ userId: props.userId, newPassword: newPassword() });
            toast.success(`Contraseña de "${props.username}" actualizada. Todas sus sesiones fueron cerradas.`);
            setNewPassword('');
            setShowPassword(false);
        } catch (err: any) {
            toast.error(err?.message || 'Error al restablecer la contraseña');
        }
    };

    const isValid = () => newPassword().length >= 8;

    return (
        <>
            <div class="bg-surface/30 rounded-2xl border border-border/40 overflow-hidden">
                <div class="bg-surface/50 px-5 py-3 border-b border-border/40 font-semibold text-sm text-text flex items-center gap-2">
                    <div class="size-1.5 rounded-full bg-amber-500" />
                    Seguridad
                </div>
                <div class="p-5 space-y-3">
                    <p class="text-xs text-muted leading-relaxed">
                        Restablecer la contraseña cerrará <strong>todas</strong> las sesiones activas del usuario.
                    </p>
                    <div class="flex gap-2">
                        <div class="flex-1 relative">
                            <TextField.Root value={newPassword()} onChange={setNewPassword}>
                                <TextField.Input
                                    type={showPassword() ? 'text' : 'password'}
                                    placeholder="Nueva contraseña (mín. 8 caracteres)"
                                    class="pr-10 font-mono text-sm"
                                />
                            </TextField.Root>
                            <button
                                type="button"
                                onClick={() => setShowPassword(v => !v)}
                                class="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-muted hover:text-text transition-colors cursor-pointer"
                            >
                                <Show when={showPassword()} fallback={<EyeIcon class="size-4" />}>
                                    <EyeOffIcon class="size-4" />
                                </Show>
                            </button>
                        </div>
                        <Button variant="outline" size="sm" onClick={handleGenerate} title="Generar contraseña">
                            Generar
                        </Button>
                        <Show when={newPassword()}>
                            <Button variant="outline" size="sm" onClick={handleCopy} title="Copiar">
                                <CopyIcon class="size-4" />
                            </Button>
                        </Show>
                    </div>
                    <Button
                        variant="warning"
                        size="sm"
                        disabled={!isValid() || resetMutation.isPending}
                        loading={resetMutation.isPending}
                        loadingText="Restableciendo..."
                        onClick={() => setShowConfirm(true)}
                        class="w-full"
                    >
                        Restablecer contraseña
                    </Button>
                </div>
            </div>

            <ConfirmDialog
                isOpen={showConfirm()}
                onClose={() => setShowConfirm(false)}
                onConfirm={handleReset}
                title="¿Restablecer contraseña?"
                description={`La contraseña de "${props.username}" será cambiada y todas sus sesiones activas serán cerradas inmediatamente.`}
                confirmLabel="Restablecer"
                variant="warning"
                isLoading={resetMutation.isPending}
                loadingText="Restableciendo..."
            />
        </>
    );
};

export default UserShowPanel;
