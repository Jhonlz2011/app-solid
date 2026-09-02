import { createSignal } from 'solid-js';
import { clientId } from '../lib/eden';
import { RealtimeEvents } from '@app/schema/realtime-events';
import { getSseUrl } from '../config/runtime-env';
import { resolveSlugFromHost } from '@app/schema/utils';

// --- CONFIGURATION ---
const SSE_URL = getSseUrl();
// --- GLOBAL STATE ---
const [eventSource, setEventSource] = createSignal<EventSource | null>(null);
const [isConnected, setIsConnected] = createSignal(false);

// --- HEARTBEAT WATCHDOG ---
const HEARTBEAT_TIMEOUT_MS = 45000; // 45s (servidor emite cada 25s)
let watchdogTimer: ReturnType<typeof setTimeout> | null = null;

const resetWatchdog = () => {
    if (watchdogTimer) clearTimeout(watchdogTimer);
    watchdogTimer = setTimeout(() => {
        console.warn('⏱️ SSE Watchdog: Sin respuesta del servidor en 45s. Forzando reconexión...');
        disconnect();
        setTimeout(() => connect(), 1500);
    }, HEARTBEAT_TIMEOUT_MS);
};

const clearWatchdog = () => {
    if (watchdogTimer) {
        clearTimeout(watchdogTimer);
        watchdogTimer = null;
    }
};

// --- PUBLIC API ---

export const connect = (token?: string | null) => {
    const es = eventSource();
    if (es && (es.readyState === EventSource.OPEN || es.readyState === EventSource.CONNECTING)) return;

    try {
        const url = new URL(SSE_URL);
        url.searchParams.set('clientId', clientId);
        if (token) url.searchParams.set('token', token);
        if (typeof window !== 'undefined') {
            const currentSlug = resolveSlugFromHost(window.location.hostname);
            if (currentSlug) url.searchParams.set('slug', currentSlug);
        }
        
        const newEs = new EventSource(url.toString(), { withCredentials: true });
        setEventSource(newEs);

        newEs.onopen = () => {
            console.log('✅ SSE Connected');
            setIsConnected(true);
            resetWatchdog();
            
            // Broadcast connection recovery
            window.dispatchEvent(new CustomEvent('sse:connected'));
        };

        // Escuchar heartbeat explícito del servidor
        newEs.addEventListener('heartbeat', () => {
            resetWatchdog();
        });

        // El evento de "conexión" del backend ("event: connected")
        newEs.addEventListener('connected', () => {
             resetWatchdog();
        });
        
        // Escuchar SOLO los eventos válidos de entidad y usuario. Ignorar el diccionario de constantes de ROOMS!
        const activeCategories = [RealtimeEvents.ENTITY, RealtimeEvents.USER];
        for (const category of activeCategories) {
            for (const eventName of Object.values(category as Record<string, string>)) {
                newEs.addEventListener(eventName, (event) => {
                    resetWatchdog();
                    try {
                        const parsedData = JSON.parse((event as MessageEvent).data);
                        window.dispatchEvent(new CustomEvent(eventName, { detail: parsedData }));
                    } catch (e) {
                        console.error(`Error parsing SSE event ${eventName}:`, e);
                    }
                });
            }
        }

        // P1-7: Use a 2s delay before closing SSE on error to tolerate transient
        // network hiccups. Avoids premature close when navigator.onLine is stale.
        let offlineCloseTimer: ReturnType<typeof setTimeout> | null = null;
        newEs.onerror = () => {
            clearWatchdog();
            setIsConnected(false);
            // Clear any pending close timer if we get a rapid error→recovery cycle
            if (offlineCloseTimer) clearTimeout(offlineCloseTimer);

            if (typeof navigator !== 'undefined' && !navigator.onLine) {
                // Delay close by 2s — MainLayout will reconnect via isOnline() signal
                offlineCloseTimer = setTimeout(() => {
                    if (!navigator.onLine) {
                        console.log('🔌 SSE: Offline confirmado tras 2s. Cerrando conexión SSE.');
                        newEs.close();
                        setEventSource(null);
                    } else {
                        console.log('⚠️ SSE: Red recuperada durante grace period. Manteniendo conexión.');
                    }
                }, 2000);
            } else {
                console.log('⚠️ SSE: Error temporal. Navegador reintentará reconectar.');
            }
        };

    } catch (error) {
        clearWatchdog();
        console.error('Failed to create SSE connection:', error);
    }
};

export const disconnect = () => {
    clearWatchdog();
    eventSource()?.close();
    setEventSource(null);
    setIsConnected(false);
};

export const enableReconnect = () => {
    // No-op. Dejamos que el navegador decida automáticamente.
};

// --- API EXPORTS ---
export const useSSE = () => {
    return {
        eventSource,
        isConnected,
        connect,
        disconnect
    };
};
