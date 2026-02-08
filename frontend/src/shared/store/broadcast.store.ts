// src/shared/store/broadcast.store.ts
// Centralized Event Bus for cross-tab synchronization via BroadcastChannel
// Consolidates auth_sync, sessions_sync, and profile updates into a single channel

type MessageHandler = (data: any) => void;

// Single BroadcastChannel for all app-wide cross-tab sync
const channel = typeof window !== 'undefined' ? new BroadcastChannel('app_sync') : null;

// Track listeners for cleanup
const listeners = new Map<string, Set<MessageHandler>>();

// Prevent multiple initializations
let initialized = false;

/**
 * Initialize the broadcast store (call once in app entry)
 */
export const initBroadcast = () => {
    if (initialized || !channel) return;
    initialized = true;

    channel.onmessage = (e: MessageEvent) => {
        const { type, data } = e.data || {};
        if (!type) return;


        // Call all registered handlers for this type
        const handlers = listeners.get(type);
        if (handlers) {
            handlers.forEach(handler => handler(data));
        }

        // Also dispatch as window event for backwards compatibility
        window.dispatchEvent(new CustomEvent(`bc:${type}`, { detail: data }));
    };
};

/**
 * Emit an event to other tabs (and locally)
 * Data is auto-sanitized via JSON serialization
 */
export const emit = (type: string, data?: any) => {
    // Sanitize data by converting to plain JSON (removes non-serializable properties)
    const safeData = data !== undefined ? JSON.parse(JSON.stringify(data)) : undefined;
    const message = { type, data: safeData };

    // Send to other tabs
    if (channel) {
        channel.postMessage(message);
    }

    // Also emit locally for same-tab reactivity
    const handlers = listeners.get(type);
    if (handlers) {
        handlers.forEach(handler => handler(safeData));
    }

};

/**
 * Subscribe to an event type
 * Returns cleanup function to remove the listener
 */
export const on = (type: string, handler: MessageHandler): (() => void) => {
    if (!listeners.has(type)) {
        listeners.set(type, new Set());
    }
    listeners.get(type)!.add(handler);

    // Return cleanup function
    return () => {
        listeners.get(type)?.delete(handler);
        if (listeners.get(type)?.size === 0) {
            listeners.delete(type);
        }
    };
};

/**
 * Remove all listeners for a type (useful for testing)
 */
export const off = (type: string) => {
    listeners.delete(type);
};

// Export a convenient object API
export const broadcast = {
    init: initBroadcast,
    emit,
    on,
    off,
};

// Event type constants for type safety
export const BroadcastEvents = {
    // Auth events
    TOKEN_SYNC: 'auth:token_sync',
    TOKEN_REQUEST: 'auth:token_request',
    TOKEN_RESPONSE: 'auth:token_response',
    LOGOUT: 'auth:logout',
    PROFILE_UPDATE: 'auth:profile_update',
    // Session events
    SESSIONS_REFRESH: 'sessions:refresh',
} as const;
