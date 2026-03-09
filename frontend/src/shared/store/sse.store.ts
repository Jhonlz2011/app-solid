import { createSignal } from 'solid-js';
import { api, clientId } from '../lib/eden';
import { RealtimeEvents } from '@app/schema/realtime-events';

// --- CONFIGURATION ---
const SSE_URL = import.meta.env.VITE_SSE_URL || 'http://localhost:3000/api/sse';
// --- GLOBAL STATE ---
const [eventSource, setEventSource] = createSignal<EventSource | null>(null);
const [isConnected, setIsConnected] = createSignal(false);

// Private variables
const activeSubscriptions = new Set<string>();

// --- INTERNAL LOGIC ---
const handleRoomSubscription = async (room: string, action: 'subscribe' | 'unsubscribe') => {
    try {
        if (action === 'subscribe') {
            await api.api.sse.join.post({ clientId, room });
            activeSubscriptions.add(room);
        } else {
            await api.api.sse.leave.post({ clientId, room });
            activeSubscriptions.delete(room);
        }
    } catch (e) {
        console.error(`SSE ${action} failed for room ${room}:`, e);
    }
}

// --- PUBLIC API ---

export const connect = (token?: string | null) => {
    const es = eventSource();
    if (es && (es.readyState === EventSource.OPEN || es.readyState === EventSource.CONNECTING)) return;

    try {
        const url = new URL(SSE_URL);
        url.searchParams.set('clientId', clientId);
        if (token) url.searchParams.set('token', token);
        
        const newEs = new EventSource(url.toString(), { withCredentials: true });
        setEventSource(newEs);

        newEs.onopen = () => {
            console.log('✅ SSE Connected');
            setIsConnected(true);
            
            // Broadcast connection recovery
            window.dispatchEvent(new CustomEvent('sse:connected'));
        };

        // El evento de "conexión" del backend ("event: connected")
        newEs.addEventListener('connected', () => {
             // Re-subscribe to all active rooms after a successful connection
             activeSubscriptions.forEach(room => {
                 handleRoomSubscription(room, 'subscribe');
             });
        });
        
        // Escuchar SOLO los eventos válidos de entidad y usuario. Ignorar el diccionario de constantes de ROOMS!
        const activeCategories = [RealtimeEvents.ENTITY, RealtimeEvents.USER];
        for (const category of activeCategories) {
            for (const eventName of Object.values(category as Record<string, string>)) {
                newEs.addEventListener(eventName, (event) => {
                    try {
                        const parsedData = JSON.parse((event as MessageEvent).data);
                        window.dispatchEvent(new CustomEvent(eventName, { detail: parsedData }));
                    } catch (e) {
                        console.error(`Error parsing SSE event ${eventName}:`, e);
                    }
                });
            }
        }

        newEs.onerror = () => {
            console.log(`❌ SSE Disconnected - Navegador intentará reconectar automáticamente...`);
            setIsConnected(false);
            // Confiar 100% en la reconexión nativa. No hacer close().
        };

    } catch (error) {
        console.error('Failed to create SSE connection:', error);
    }
};

export const disconnect = () => {
    eventSource()?.close();
    setEventSource(null);
    setIsConnected(false);
    activeSubscriptions.clear();
};

export const enableReconnect = () => {
    // No-op. Dejamos que el navegador decida automáticamente.
};

export const subscribe = (room: string) => {
    // Add to active subscriptions anyway, so it subscribes on reconnect
    activeSubscriptions.add(room);
    
    // If connected, issue request now
    if (isConnected()) {
        handleRoomSubscription(room, 'subscribe');
    }
};

export const unsubscribe = (room: string) => {
    activeSubscriptions.delete(room);
    if (isConnected()) {
        handleRoomSubscription(room, 'unsubscribe');
    }
};

// --- API EXPORTS ---
export const useSSE = () => {
    return {
        eventSource,
        isConnected,
        subscribe,
        unsubscribe,
        connect,
        disconnect
    };
};
