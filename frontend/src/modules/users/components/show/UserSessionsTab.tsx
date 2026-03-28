import { Component, For, Show, createSignal, onMount, onCleanup } from 'solid-js';
import { toast } from 'solid-sonner';
import { useQueryClient } from '@tanstack/solid-query';
import { useSSE } from '@shared/store/sse.store';
import { RealtimeEvents } from '@app/schema/realtime-events';
import { rbacKeys } from '../../data/users.keys';
import { SessionItem } from '@modules/profile/components/SessionItem';
import { DeviceIcon } from '@shared/ui/icons';
import { ListItemSkeleton } from '@shared/ui/SkeletonLoader';
import ErrorState from '@shared/ui/ErrorState';
import ConfirmDialog from '@shared/ui/ConfirmDialog';
import { useUserSessions, useRevokeUserSession } from '../../data/users.queries';

const UserSessionsTab: Component<{ userId: number }> = (props) => {
    const queryClient = useQueryClient();
    const { subscribe, unsubscribe } = useSSE();
    const sessionsQuery = useUserSessions(() => props.userId);
    const revokeMutation = useRevokeUserSession();
    const [revoking, setRevoking] = createSignal<string | null>(null);
    const [confirmRevoke, setConfirmRevoke] = createSignal<string | null>(null);

    const sessions = () => sessionsQuery.data ?? [];
    const isLoading = () => sessionsQuery.isLoading;

    // ── SSE: Real-time session updates ──
    onMount(() => {
        const room = `user:${props.userId}`;
        subscribe(room);

        const handleSessionChange = () => {
            queryClient.invalidateQueries({
                queryKey: rbacKeys.userSessions(props.userId),
            });
        };

        window.addEventListener(RealtimeEvents.USER.SESSION_REVOKED, handleSessionChange);
        window.addEventListener(RealtimeEvents.USER.SESSION_CREATED, handleSessionChange);

        onCleanup(() => {
            unsubscribe(room);
            window.removeEventListener(RealtimeEvents.USER.SESSION_REVOKED, handleSessionChange);
            window.removeEventListener(RealtimeEvents.USER.SESSION_CREATED, handleSessionChange);
        });
    });

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
                        {(session) => (
                            <SessionItem
                                session={session}
                                onRevoke={(id) => setConfirmRevoke(id)}
                                isRevoking={revoking() === session.id}
                                compact
                            />
                        )}
                    </For>
                </div>
            </Show>

            <ConfirmDialog
                isOpen={!!confirmRevoke()}
                onClose={() => setConfirmRevoke(null)}
                onConfirm={() => confirmRevoke() && handleRevoke(confirmRevoke()!)}
                title="¿Cerrar sesión?"
                description="El usuario será desconectado de este dispositivo inmediatamente."
                confirmLabel="Cerrar sesión"
                variant="danger"
                isLoading={!!revoking()}
                loadingText="Cerrando sesión..."
            />
        </div>
    );
};

export default UserSessionsTab;
