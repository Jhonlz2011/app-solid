import { Component, createSignal, For, Show, onMount, onCleanup } from 'solid-js';
import { createQuery, createMutation, useQueryClient } from '@tanstack/solid-query';
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
        <div class="p-6 max-w-3xl mx-auto">
            <div class="mb-6">
                <h1 class="text-2xl font-bold text-heading">Sesiones Activas</h1>
                <p class="text-muted mt-1">Gestiona los dispositivos donde has iniciado sesión.</p>
            </div>

            <Show when={sessionsQuery.isLoading}>
                <div class="flex justify-center py-12">
                    <div class="animate-spin rounded-full h-8 w-8 border-2 border-primary border-t-transparent"></div>
                </div>
            </Show>

            <Show when={sessionsQuery.isError}>
                <div class="text-center py-12 text-red-400">
                    Error al cargar las sesiones. Intenta de nuevo.
                </div>
            </Show>

            <Show when={sessionsQuery.data}>
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

