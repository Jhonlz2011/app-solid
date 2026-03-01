import { createSignal } from 'solid-js';
import { decode } from '@msgpack/msgpack';
import type { WsMessage, EntityEventPayload } from '@app/schema/ws-events';

// --- CONFIGURACIÓN ---
const WS_URL = import.meta.env.VITE_WS_URL || 'ws://localhost:3000/api/ws';
const MAX_RECONNECT_ATTEMPTS = 5;

// --- ESTADO GLOBAL (Signals fuera de componentes) ---
const [socket, setSocket] = createSignal<WebSocket | null>(null);
const [isConnected, setIsConnected] = createSignal(false);

// Variables privadas (no reactivas)
let reconnectTimeout: ReturnType<typeof setTimeout> | null = null;
let reconnectAttempts = 0;
let shouldReconnect = true;
let lastConnectTime = 0;
const pendingSubscriptions = new Set<string>();
const activeSubscriptions = new Set<string>();

// --- LÓGICA INTERNA ---

/** Internal protocol ACKs that should not be dispatched as events */
const INTERNAL_TYPES = new Set(['subscribed', 'unsubscribed']);

const dispatchMessage = (message: WsMessage<EntityEventPayload>) => {
    const eventName = message?.event || (message as any)?.type;
    const eventData = message?.data ?? message;

    // Skip internal protocol ACKs (subscribe/unsubscribe confirmations)
    if (!eventName || INTERNAL_TYPES.has(eventName)) return;

    window.dispatchEvent(new CustomEvent(eventName, { detail: eventData }));
};

// --- ACCIONES EXPORTADAS ---

export const connect = () => {
    const ws = socket();
    if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) return;

    try {
        // Cookie is sent automatically by the browser on WebSocket upgrade
        // No token needed — httpOnly session cookie handles auth
        const newWs = new WebSocket(WS_URL);
        newWs.binaryType = 'arraybuffer';

        // Store immediately so subsequent connect() calls see CONNECTING state
        setSocket(newWs);

        newWs.onopen = () => {
            console.log('✅ WebSocket Connected');
            setIsConnected(true);
            lastConnectTime = Date.now();

            // Process pending subscriptions
            pendingSubscriptions.forEach(room => subscribe(room));
            pendingSubscriptions.clear();

            // Re-subscribe active rooms (on reconnection)
            activeSubscriptions.forEach(room => {
                newWs.send(JSON.stringify({ type: 'subscribe', room }));
            });
        };

        newWs.onmessage = (event) => {
            try {
                let message: any;
                if (event.data instanceof ArrayBuffer) {
                    // MessagePack binary frame → decode
                    message = decode(new Uint8Array(event.data));
                } else if (typeof event.data === 'string') {
                    // JSON text frame
                    message = JSON.parse(event.data);
                }
                if (message) dispatchMessage(message);
            } catch (e) {
                console.error('Error parsing WS message', e);
            }
        };

        newWs.onclose = (event) => {
            console.log(`❌ WebSocket Disconnected (Code: ${event.code})`, event.reason);
            setSocket(null);
            setIsConnected(false);
            
            // Elegance: If the connection survived for more than 2 seconds before closing, 
            // it was a stable connection that eventually dropped (e.g., lost wifi). 
            // We fully reset the backoff counter to try reconnecting aggressively again.
            // If it closed immediately (e.g., 401 unauthorized drop), we don't reset, letting 
            // the exponential backoff delay grow or reach MAX_RECONNECT_ATTEMPTS.
            if (Date.now() - lastConnectTime > 2000) {
                reconnectAttempts = 0;
            }
            
            // If the server drops us due to Policy Violation (1008) or Normal Closure (1000)
            // right after authentication failure, we halt reconnections and trigger global logout.
            if (event.code === 1008 || event.code === 4001 || event.code === 4003) {
                console.warn('WS Closed due to Auth Policy Violation. Halting reconnects.');
                shouldReconnect = false;
                window.dispatchEvent(new CustomEvent('auth:unauthorized'));
            } else {
                attemptReconnect();
            }
        };

        newWs.onerror = (err) => console.error('WS Error', err);

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
    shouldReconnect = false;
    if (reconnectTimeout) clearTimeout(reconnectTimeout);
    socket()?.close();
    setSocket(null);
    setIsConnected(false);
    activeSubscriptions.clear();
    pendingSubscriptions.clear();
};

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
        activeSubscriptions.add(room);
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

// --- API PÚBLICA ---
export const useWebSocket = () => {
    return {
        socket,
        isConnected,
        subscribe,
        unsubscribe,
        connect,
        disconnect
    };
};