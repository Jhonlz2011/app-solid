import { Component, For, Show } from 'solid-js';
import Sheet from '@shared/ui/Sheet';
import Button from '@shared/ui/Button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@shared/ui/Tabs';
import { SkeletonLoader } from '@shared/ui/SkeletonLoader';
import { Avatar } from '@shared/ui/Avatar';
import { StatusBadge, RoleBadge, EntityTypeBadge } from '@shared/ui/Badge';
import { EditIcon, KeyIcon, InfoIcon, DeviceIcon, UserHistoryIcon } from '@shared/ui/icons';
import { InfoRow } from '@shared/ui/InfoRow';
import { useAuth } from '@modules/auth/store/auth.store';
import { useUser } from '../data/users.queries';

// ── Extracted Sub-Components ──
import UserSessionsTab from './show/UserSessionsTab';
import UserActivityTab from './show/UserActivityTab';
import PasswordResetSection from './PasswordResetSection';

interface UserShowPanelProps {
    userId: number;
    onClose: () => void;
}

const UserShowPanel: Component<UserShowPanelProps> = (props) => {
    const auth = useAuth();
    const userQuery = useUser(() => props.userId);

    const handleClose = () => props.onClose();

    const canUpdate = () => auth.canEdit?.('users') ?? false;

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
                            <div class="sticky top-0 z-20 bg-card pt-5 flex flex-col gap-5 px-1 -mx-1">
                                {/* Header */}
                                <div class="flex items-start justify-between shrink-0">
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
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        class="gap-2 shrink-0 bg-surface/50 hover:bg-surface"
                                        search={(prev: any) => ({
                                            ...prev,
                                            panel: 'edit',
                                            id: props.userId,
                                            from: 'show'
                                        })}
                                        disabled={!props.userId}
                                        preload="intent"
                                    >
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
                                <TabsContent value="general" class="space-y-4">
                                    {/* Account Info */}
                                    <div class="bg-surface/30 rounded-2xl border border-border/40 overflow-hidden">
                                        <div class="bg-surface/50 px-4 py-3 border-b border-border/40 font-semibold text-sm text-text flex items-center gap-2">
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
                                                <div class="bg-surface/50 px-4 py-3 border-b border-border/40 font-semibold text-sm text-text flex items-center gap-2">
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
                                                                    <EntityTypeBadge type="employee" />
                                                                </Show>
                                                                <Show when={entity().isClient}>
                                                                    <EntityTypeBadge type="client" />
                                                                </Show>
                                                                <Show when={entity().isSupplier}>
                                                                    <EntityTypeBadge type="supplier" />
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
                                        <div class="bg-surface/50 px-4 py-3 border-b border-border/40 font-semibold text-sm text-text flex items-center gap-2">
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
                                <TabsContent value="sessions">
                                    <UserSessionsTab userId={props.userId} />
                                </TabsContent>

                                <TabsContent value="activity">
                                    <UserActivityTab userId={props.userId} />
                                </TabsContent>
                                </div>
                            </Tabs>
                        )}
                </Show>
            </Show>
        </Sheet>
    );
};

export default UserShowPanel;
