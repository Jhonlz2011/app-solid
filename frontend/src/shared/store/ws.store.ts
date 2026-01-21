import { createSignal, batch } from 'solid-js';
import { decode } from '@msgpack/msgpack';

// --- CONFIGURACIÓN ---
const WS_URL = import.meta.env.VITE_WS_URL || 'ws://localhost:3000/api/ws';
const MAX_RECONNECT_ATTEMPTS = 5;

// --- ESTADO GLOBAL (Signals fuera de componentes) ---
const [socket, setSocket] = createSignal<WebSocket | null>(null);
const [isConnected, setIsConnected] = createSignal(false);

// Variables privadas (no reactivas)
let reconnectTimeout: ReturnType<typeof setTimeout> | null = null;
let reconnectAttempts = 0;
let shouldReconnect = true; // Controla si debe reconectarse automáticamente
const pendingSubscriptions = new Set<string>();
const activeSubscriptions = new Set<string>();

// --- LÓGICA INTERNA ---

const dispatchMessage = (message: any) => {
    const eventName = message?.event || message?.type;
    const eventData = message?.data ?? message;
    if (eventName) {
        // Mantenemos tu sistema de eventos global, es útil para desacoplar
        window.dispatchEvent(new CustomEvent(eventName, { detail: eventData }));
    }
};

// --- ACCIONES EXPORTADAS ---

export const connect = () => {
    if (socket()?.readyState === WebSocket.OPEN) return;

    try {
        const ws = new WebSocket(WS_URL);
        ws.binaryType = 'arraybuffer';

        ws.onopen = () => {
            console.log('✅ WebSocket Connected');
            batch(() => {
                setSocket(ws);
                setIsConnected(true);
            });
            reconnectAttempts = 0;

            // Procesar suscripciones pendientes
            pendingSubscriptions.forEach(room => subscribe(room));
            pendingSubscriptions.clear();

            // Re-suscribir a las activas (si fue una reconexión)
            activeSubscriptions.forEach(room => {
                ws.send(JSON.stringify({ type: 'subscribe', room }));
            });
        };

        ws.onmessage = (event) => {
            try {
                let message: any;
                if (event.data instanceof ArrayBuffer) {
                    message = decode(new Uint8Array(event.data));
                } else if (typeof event.data === 'string') {
                    message = JSON.parse(event.data);
                }
                if (message) dispatchMessage(message);
            } catch (e) {
                console.error('Error parsing WS message', e);
            }
        };

        ws.onclose = () => {
            console.log('❌ WebSocket Disconnected');
            batch(() => {
                setSocket(null);
                setIsConnected(false);
            });
            attemptReconnect();
        };

        ws.onerror = (err) => console.error('WS Error', err);

    } catch (error) {
        console.error('Failed to create WebSocket:', error);
    }
};

const attemptReconnect = () => {
    if (shouldReconnect && reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
        const delay = Math.min(1000 * Math.pow(2, reconnectAttempts), 30000);
        console.log(`🔄 Reconnecting in ${delay}ms...`);
        reconnectTimeout = setTimeout(() => {
            reconnectAttempts++;
            connect();
        }, delay);
    }
};

export const disconnect = () => {
    shouldReconnect = false; // Prevenir reconexión automática después de logout
    if (reconnectTimeout) clearTimeout(reconnectTimeout);
    socket()?.close();
    setSocket(null);
    setIsConnected(false);
    // Clear subscriptions to prevent stale rooms when logging in as different user
    activeSubscriptions.clear();
    pendingSubscriptions.clear();
};

/**
 * Re-enable automatic reconnection (call before connect after login)
 */
export const enableReconnect = () => {
    shouldReconnect = true;
    reconnectAttempts = 0;
};

export const subscribe = (room: string) => {
    const ws = socket();
    if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'subscribe', room }));
        activeSubscriptions.add(room);
    } else {
        pendingSubscriptions.add(room);
        activeSubscriptions.add(room); // La marcamos como activa para cuando se reconecte
    }
};

export const unsubscribe = (room: string) => {
    const ws = socket();
    activeSubscriptions.delete(room);
    pendingSubscriptions.delete(room);
    if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'unsubscribe', room }));
    }
};

// --- API PÚBLICA (HOOK SIMULADO) ---
// Esto hace que se sienta igual que antes, pero sin Context
export const useWebSocket = () => {
    return {
        socket,       // Signal getter
        isConnected,  // Signal getter
        subscribe,
        unsubscribe,
        connect,
        disconnect
    };
};