import { Component, createSignal, For, Show, onMount, onCleanup } from 'solid-js';
import { createQuery, createMutation, useQueryClient } from '@tanstack/solid-query';
import { request } from '@shared/lib/http';
import { useWebSocket } from '@shared/store/ws.store';
import { useAuth } from '@modules/auth/auth.store';

interface Session {
    id: number;
    user_agent: string | null;
    ip_address: string | null;
    created_at: string;
    is_current: boolean;
}

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

            const handleUpdate = (e: CustomEvent) => {
                if (e.detail?.type === 'login' || e.detail?.type === 'logout' || e.detail?.type === 'revoke') {
                    queryClient.invalidateQueries({ queryKey: ['auth', 'sessions'] });
                }
            };

            window.addEventListener('sessions:update', handleUpdate as EventListener);

            onCleanup(() => {
                unsubscribe(room);
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

    const parseUserAgent = (ua: string | null): { browser: string; os: string; icon: string } => {
        if (!ua) return { browser: 'Desconocido', os: 'Desconocido', icon: 'M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z' };

        let browser = 'Navegador';
        let os = 'Sistema';
        let icon = 'M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z'; // Desktop default

        // OS Detection
        if (ua.includes('Windows')) {
            os = 'Windows';
            icon = 'M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z';
        } else if (ua.includes('Mac')) {
            os = 'macOS';
            icon = 'M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z';
        } else if (ua.includes('Linux')) {
            os = 'Linux';
            icon = 'M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z';
        } else if (ua.includes('Android')) {
            os = 'Android';
            icon = 'M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z'; // Mobile
        } else if (ua.includes('iPhone') || ua.includes('iPad')) {
            os = 'iOS';
            icon = 'M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z'; // Mobile
        }

        // Browser Detection
        if (ua.includes('Chrome') && !ua.includes('Edge')) browser = 'Chrome';
        else if (ua.includes('Firefox')) browser = 'Firefox';
        else if (ua.includes('Safari') && !ua.includes('Chrome')) browser = 'Safari';
        else if (ua.includes('Edge')) browser = 'Edge';

        return { browser, os, icon };
    };

    const formatDate = (dateStr: string): string => {
        const d = new Date(dateStr);
        return d.toLocaleDateString('ec-ES', {
            day: 'numeric',
            month: 'short',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
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
                        {(session) => {
                            const { browser, os, icon } = parseUserAgent(session.user_agent);
                            return (
                                <div
                                    classList={{
                                        'surface-panel rounded-xl p-4 border transition-all': true,
                                        'border-primary/30 bg-primary/5 ring-1 ring-primary/20': session.is_current,
                                        'border-surface hover:border-border': !session.is_current,
                                    }}
                                >
                                    <div class="flex items-start justify-between gap-4">
                                        <div class="flex items-center gap-4">
                                            <div
                                                class={`w-12 h-12 rounded-xl flex items-center justify-center transition-colors ${session.is_current ? 'bg-primary text-white shadow-lg shadow-primary/20' : 'bg-surface-alt text-muted'
                                                    }`}
                                            >
                                                <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d={icon} />
                                                </svg>
                                            </div>
                                            <div>
                                                <div class="flex items-center gap-2">
                                                    <span class="font-semibold text-heading text-lg">{os}</span>
                                                    <Show when={session.is_current}>
                                                        <span class="text-[10px] uppercase tracking-wider bg-primary text-white px-2 py-0.5 rounded-full font-bold shadow-sm">
                                                            Actual
                                                        </span>
                                                    </Show>
                                                </div>
                                                <div class="text-sm text-muted mt-0.5 flex items-center gap-2">
                                                    <span>{browser}</span>
                                                    <span class="w-1 h-1 rounded-full bg-border"></span>
                                                    <span>{session.ip_address || 'IP desconocida'}</span>
                                                </div>
                                                <div class="text-xs text-muted/70 mt-1">
                                                    Iniciado el {formatDate(session.created_at)}
                                                </div>
                                            </div>
                                        </div>
                                        <Show when={!session.is_current}>
                                            <button
                                                onClick={() => handleRevoke(session.id)}
                                                disabled={revoking() === session.id}
                                                class="px-4 py-2 text-sm font-medium text-red-500 hover:bg-red-500/10 rounded-lg transition-all disabled:opacity-50 active:scale-95"
                                            >
                                                {revoking() === session.id ? 'Revocando...' : 'Cerrar Sesión'}
                                            </button>
                                        </Show>
                                    </div>
                                </div>
                            );
                        }}
                    </For>
                </div>
            </Show>
        </div>
    );
};

export default SessionsPage;
