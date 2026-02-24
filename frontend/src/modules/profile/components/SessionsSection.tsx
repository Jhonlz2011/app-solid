// Sessions Section - Embedded Session Management (Optimized for 0ms UX)
import { Component, createSignal, For, Show, onMount, onCleanup } from 'solid-js';
import { createQuery, createMutation, useQueryClient } from '@tanstack/solid-query';
import { toast } from 'solid-sonner';
import { api } from '@shared/lib/eden';
import { useWebSocket } from '@shared/store/ws.store';
import { useAuth } from '@modules/auth/store/auth.store';
import { SessionItem, type Session } from './SessionItem';
import { DeviceIcon, WarningIcon } from '@shared/ui/icons';
import { broadcast, BroadcastEvents } from '@shared/store/broadcast.store';

// Skeleton loader component for instant perceived loading
const SessionSkeleton: Component = () => (
    <div class="rounded-xl p-4 border border-border animate-pulse">
        <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
            <div class="flex items-center gap-3 sm:gap-4">
                <div class="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-card-alt shrink-0" />
                <div class="flex-1 space-y-2">
                    <div class="h-5 w-32 bg-card-alt rounded" />
                    <div class="h-4 w-48 bg-card-alt rounded" />
                    <div class="h-3 w-40 bg-card-alt rounded" />
                </div>
            </div>
        </div>
    </div>
);

export const SessionsSection: Component = () => {
    const queryClient = useQueryClient();
    const auth = useAuth();
    const { subscribe, unsubscribe } = useWebSocket();
    const [revoking, setRevoking] = createSignal<string | null>(null);

    const sessionsQuery = createQuery(() => ({
        queryKey: ['auth', 'sessions'],
        queryFn: async (): Promise<Session[]> => {
            const { data, error } = await api.api.auth.sessions.get();
            if (error) throw new Error(String(error.value));
            // Map Date to string for SessionItem component
            return (data as any[]).map(s => ({
                ...s,
                created_at: typeof s.created_at === 'string' ? s.created_at : s.created_at.toISOString(),
            }));
        },
        // 2026 Best Practices for 0ms UX:
        staleTime: 60 * 1000, // Data stays fresh for 1 minute
        gcTime: 5 * 60 * 1000, // Keep in cache for 5 minutes
        refetchOnMount: false, // Don't refetch if we have fresh data
        refetchOnWindowFocus: false, // Avoid unnecessary refetches
    }));

    // Real-time updates
    onMount(() => {
        const userId = auth.user()?.id;
        if (userId) {
            const room = `user:${userId}`;
            subscribe(room);

            // Listen for cross-tab session updates via centralized broadcast
            const cleanupBroadcast = broadcast.on(BroadcastEvents.SESSIONS_REFRESH, () => {
                queryClient.invalidateQueries({ queryKey: ['auth', 'sessions'] });
            });

            // Listen for WebSocket session events (login/logout/revoke)
            const handleUpdate = (e: CustomEvent) => {
                if (e.detail?.type === 'login' || e.detail?.type === 'logout' || e.detail?.type === 'revoke') {
                    queryClient.invalidateQueries({ queryKey: ['auth', 'sessions'] });
                    // Notify other tabs to refresh their sessions list
                    broadcast.emit(BroadcastEvents.SESSIONS_REFRESH);
                }
            };

            window.addEventListener('sessions:update', handleUpdate as EventListener);

            onCleanup(() => {
                unsubscribe(room);
                cleanupBroadcast();
                window.removeEventListener('sessions:update', handleUpdate as EventListener);
            });
        }
    });

    const revokeMutation = createMutation(() => ({
        mutationFn: async (sessionId: string) => {
            const { error } = await api.api.auth.sessions({ id: sessionId }).delete();
            if (error) throw new Error(String(error.value));
            return { success: true };
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['auth', 'sessions'] });
            toast.success('Sesión cerrada correctamente');
        },
        onError: () => {
            toast.error('No se pudo cerrar la sesión');
        },
    }));

    const handleRevoke = async (sessionId: string) => {
        setRevoking(sessionId);
        try {
            await revokeMutation.mutateAsync(sessionId);
        } finally {
            setRevoking(null);
        }
    };

    // Derived state
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
                        {/* Subtle indicator when background refetching */}
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

            {/* Initial Loading State - Show Skeletons */}
            <Show when={isInitialLoading()}>
                <div class="space-y-3">
                    <SessionSkeleton />
                    <SessionSkeleton />
                </div>
            </Show>

            {/* Error State */}
            <Show when={sessionsQuery.isError && !hasCachedData()}>
                <div class="text-center py-8">
                    <div class="size-12 mx-auto mb-3 rounded-full bg-danger/10 flex items-center justify-center">
                        <WarningIcon class="size-6 text-danger" />
                    </div>
                    <p class="text-danger text-sm mb-3">Error al cargar las sesiones</p>
                    <button
                        onClick={() => sessionsQuery.refetch()}
                        class="px-4 py-2 bg-card-alt hover:bg-border rounded-lg text-sm transition-colors"
                    >
                        Reintentar
                    </button>
                </div>
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

            {/* Sessions List - Shows cached data even during refetch */}
            <Show when={sessions().length > 0}>
                <div class="space-y-3">
                    <For each={sessions()}>
                        {(session) => (
                            <SessionItem
                                session={session}
                                onRevoke={handleRevoke}
                                isRevoking={revoking() === session.id}
                            />
                        )}
                    </For>
                </div>
            </Show>
        </div>
    );
};
