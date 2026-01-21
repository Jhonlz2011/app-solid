import { Component, createSignal, For, Show, onMount, onCleanup } from 'solid-js';
import { createQuery, createMutation, useQueryClient } from '@tanstack/solid-query';
import { toast } from 'solid-sonner';
import { request } from '@shared/lib/http';
import { useWebSocket } from '@shared/store/ws.store';
import { useAuth } from '@modules/auth/auth.store';
import { SessionItem, Session } from '../components/SessionItem';

const SessionsPage: Component = () => {
    const queryClient = useQueryClient();
    const auth = useAuth();
    const { subscribe, unsubscribe } = useWebSocket();
    const [revoking, setRevoking] = createSignal<number | null>(null);

    const sessionsQuery = createQuery(() => ({
        queryKey: ['auth', 'sessions'],
        queryFn: async () => {
            return request<Session[]>('/auth/sessions');
        },
    }));

    // Real-time updates
    onMount(() => {
        const userId = auth.user()?.id;
        if (userId) {
            const room = `user:${userId}`;
            subscribe(room);

            // BroadcastChannel for cross-tab sync (same browser)
            const sessionsChannel = new BroadcastChannel('sessions_sync');
            sessionsChannel.onmessage = () => {
                queryClient.invalidateQueries({ queryKey: ['auth', 'sessions'] });
            };

            const handleUpdate = (e: CustomEvent) => {
                if (e.detail?.type === 'login' || e.detail?.type === 'logout' || e.detail?.type === 'revoke') {
                    queryClient.invalidateQueries({ queryKey: ['auth', 'sessions'] });
                    // Notify other tabs in the same browser to refresh
                    sessionsChannel.postMessage({ type: 'refresh' });
                }
            };

            window.addEventListener('sessions:update', handleUpdate as EventListener);

            onCleanup(() => {
                unsubscribe(room);
                sessionsChannel.close();
                window.removeEventListener('sessions:update', handleUpdate as EventListener);
            });
        }
    });

    const revokeMutation = createMutation(() => ({
        mutationFn: async (sessionId: number) => {
            return request(`/auth/sessions/${sessionId}`, { method: 'DELETE' });
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['auth', 'sessions'] });
            toast.success('Sesión cerrada correctamente');
        },
        onError: () => {
            toast.error('No se pudo cerrar la sesión');
        },
    }));

    const handleRevoke = async (sessionId: number) => {
        setRevoking(sessionId);
        try {
            await revokeMutation.mutateAsync(sessionId);
        } finally {
            setRevoking(null);
        }
    };

    return (
        <div class="p-4 sm:p-6 max-w-3xl mx-auto">
            <div class="mb-6">
                <h1 class="text-2xl font-bold text-heading">Sesiones Activas</h1>
                <p class="text-muted mt-1">Gestiona los dispositivos donde has iniciado sesión.</p>
            </div>

            {/* Loading State */}
            <Show when={sessionsQuery.isLoading}>
                <div class="flex justify-center py-12">
                    <div class="animate-spin rounded-full h-8 w-8 border-2 border-primary border-t-transparent"></div>
                </div>
            </Show>

            {/* Error State */}
            <Show when={sessionsQuery.isError}>
                <div class="text-center py-12">
                    <div class="w-14 h-14 mx-auto mb-4 rounded-full bg-red-500/10 flex items-center justify-center">
                        <svg class="w-7 h-7 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                        </svg>
                    </div>
                    <p class="text-red-400 mb-4">Error al cargar las sesiones</p>
                    <button
                        onClick={() => sessionsQuery.refetch()}
                        class="px-4 py-2 bg-surface-alt hover:bg-border rounded-lg text-sm transition-colors"
                    >
                        Reintentar
                    </button>
                </div>
            </Show>

            {/* Empty State */}
            <Show when={sessionsQuery.data && sessionsQuery.data.length === 0}>
                <div class="text-center py-12">
                    <div class="w-14 h-14 mx-auto mb-4 rounded-full bg-surface-alt flex items-center justify-center">
                        <svg class="w-7 h-7 text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                        </svg>
                    </div>
                    <p class="text-muted">No hay sesiones activas</p>
                </div>
            </Show>

            {/* Sessions List */}
            <Show when={sessionsQuery.data && sessionsQuery.data.length > 0}>
                <div class="space-y-3">
                    <For each={sessionsQuery.data}>
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

export default SessionsPage;
