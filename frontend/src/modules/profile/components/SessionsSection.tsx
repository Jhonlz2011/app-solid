/**
 * SessionsSection — My active sessions (Profile page)
 *
 * Uses centralized queries/mutations from the data layer.
 * Real-time updates via SSE + BroadcastChannel.
 */
import { Component, createSignal, createEffect, For, Show, onCleanup } from 'solid-js';
import { useQueryClient } from '@tanstack/solid-query';
import { toast } from 'solid-sonner';
import { useSSE } from '@shared/store/sse.store';
import { useAuth } from '@modules/auth/store/auth.store';
import { SessionItem } from '@shared/ui/SessionItem';
import { DeviceIcon } from '@shared/ui/icons';
import { broadcast, BroadcastEvents } from '@shared/store/broadcast.store';
import { RealtimeEvents } from '@app/schema/realtime-events';
import { ListItemSkeleton } from '@shared/ui/SkeletonLoader';
import ErrorState from '@shared/ui/ErrorState';
import { profileKeys } from '../data/profile.keys';
import { useMySessions } from '../data/profile.queries';
import { useRevokeMySession } from '../data/profile.mutations';
import ConfirmDialog from '@shared/ui/ConfirmDialog';

export const SessionsSection: Component = () => {
    const queryClient = useQueryClient();
    const auth = useAuth();
    const { subscribe, unsubscribe } = useSSE();
    const [revoking, setRevoking] = createSignal<string | null>(null);
    const [confirmRevoke, setConfirmRevoke] = createSignal<string | null>(null);

    const sessionsQuery = useMySessions();
    const revokeMutation = useRevokeMySession();

    // ── Real-time session updates ──
    const [cleanupFns, setCleanupFns] = createSignal<(() => void)[]>([]);

    createEffect(() => {
        const userId = auth.user()?.id;
        if (!userId) return;

        const room = `user:${userId}`;
        subscribe(room);

        const cleanupBroadcast = broadcast.on(BroadcastEvents.SESSIONS_REFRESH, () => {
            queryClient.invalidateQueries({ queryKey: profileKeys.sessions() });
        });

        const handleSessionsChanged = () => {
            queryClient.invalidateQueries({ queryKey: profileKeys.sessions() });
        };

        window.addEventListener(RealtimeEvents.USER.SESSION_REVOKED, handleSessionsChanged);
        window.addEventListener(RealtimeEvents.USER.SESSION_CREATED, handleSessionsChanged);

        setCleanupFns([
            () => unsubscribe(room),
            cleanupBroadcast,
            () => window.removeEventListener(RealtimeEvents.USER.SESSION_REVOKED, handleSessionsChanged),
            () => window.removeEventListener(RealtimeEvents.USER.SESSION_CREATED, handleSessionsChanged),
        ]);
    });

    onCleanup(() => cleanupFns().forEach(fn => fn()));

    // ── Handlers ──
    const handleRevoke = async (sessionId: string) => {
        setRevoking(sessionId);
        setConfirmRevoke(null);
        try {
            await revokeMutation.mutateAsync(sessionId);
            toast.success('Sesión cerrada correctamente');
        } catch {
            toast.error('No se pudo cerrar la sesión');
        } finally {
            setRevoking(null);
        }
    };

    // ── Derived state ──
    const sessions = () => sessionsQuery.data ?? [];
    const hasCachedData = () => sessionsQuery.data !== undefined;
    const isInitialLoading = () => sessionsQuery.isLoading && !hasCachedData();
    const isBackgroundRefetching = () => sessionsQuery.isFetching && hasCachedData();

    return (
        <div>
            <div class="flex items-center justify-between mb-6">
                <div>
                    <h2 class="text-lg font-semibold text-heading mb-1">
                        Sesiones activas
                        <Show when={isBackgroundRefetching()}>
                            <span class="inline-block ml-2 w-2 h-2 rounded-full bg-primary animate-pulse" />
                        </Show>
                    </h2>
                    <p class="text-sm text-muted">Dispositivos donde has iniciado sesión.</p>
                </div>
                <Show when={sessions().length > 0}>
                    <span class="px-2.5 py-1 text-xs font-bold text-nowrap rounded-full bg-primary/10 text-primary">
                        {sessions().length} activas
                    </span>
                </Show>
            </div>

            {/* Initial Loading Skeleton */}
            <Show when={isInitialLoading()}>
                <div class="space-y-3 animate-in fade-in duration-300">
                    <For each={Array.from({ length: 2 }, (_, i) => i)}>
                        {() => <ListItemSkeleton />}
                    </For>
                </div>
            </Show>

            {/* Error State */}
            <Show when={sessionsQuery.isError && !hasCachedData()}>
                <ErrorState
                    size="sm"
                    description="Error al cargar las sesiones"
                    onRetry={() => sessionsQuery.refetch()}
                />
            </Show>

            {/* Empty State */}
            <Show when={sessions().length === 0 && !isInitialLoading() && !sessionsQuery.isError}>
                <div class="text-center py-8">
                    <div class="size-12 mx-auto mb-3 rounded-full bg-card-alt flex items-center justify-center">
                        <DeviceIcon class="size-6 text-muted" />
                    </div>
                    <p class="text-muted text-sm">No hay sesiones activas</p>
                </div>
            </Show>

            {/* Sessions List */}
            <Show when={sessions().length > 0}>
                <div class="space-y-3">
                    <For each={sessions()}>
                        {(session) => (
                            <SessionItem
                                session={session}
                                onRevoke={(id) => setConfirmRevoke(id)}
                                isRevoking={revoking() === session.id}
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
                description="Serás desconectado de este dispositivo inmediatamente."
                confirmLabel="Cerrar sesión"
                variant="danger"
                isLoading={!!revoking()}
                loadingText="Cerrando sesión..."
            />
        </div>
    );
};
