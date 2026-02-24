/**
 * useDataTableWebSocket - Hook for DataTable WebSocket subscriptions
 *
 * Subscribes to a WebSocket room and auto-invalidates TanStack Query
 * when entity events are received. Uses smart invalidation:
 * - 'created' → invalidates only first-page queries (new item at top)
 * - 'updated' / 'deleted' → invalidates all list queries
 *
 * @example
 * useDataTableWebSocket({ room: 'suppliers', queryKey: supplierKeys.lists() });
 */
import { onMount, onCleanup } from 'solid-js';
import { useQueryClient } from '@tanstack/solid-query';
import { subscribe, unsubscribe } from '../store/ws.store';
import { WsEvents } from '@app/schema/ws-events';

const DEFAULT_EVENTS = [
    WsEvents.ENTITY.CREATED,
    WsEvents.ENTITY.UPDATED,
    WsEvents.ENTITY.DELETED,
];

interface UseDataTableWebSocketOptions {
    /** WebSocket room to subscribe to */
    room: string;
    /** TanStack Query key(s) to invalidate on events */
    queryKey: readonly unknown[];
    /** Custom events to listen for (defaults to entity CRUD events) */
    events?: string[];
    /** Whether the subscription is enabled */
    enabled?: boolean;
}

export function useDataTableWebSocket(options: UseDataTableWebSocketOptions) {
    const queryClient = useQueryClient();
    const events = options.events ?? DEFAULT_EVENTS;
    const enabled = options.enabled ?? true;

    onMount(() => {
        if (!enabled) return;

        // Subscribe to WebSocket room
        subscribe(options.room);

        /**
         * Smart invalidation handler:
         * - CREATED: only invalidates first-page queries (cursor pagination optimization)
         * - UPDATED/DELETED/other: invalidates all list queries
         */
        const createHandler = (eventName: string) => () => {
            if (eventName === WsEvents.ENTITY.CREATED) {
                queryClient.invalidateQueries({
                    queryKey: options.queryKey,
                    predicate: (query) => {
                        const key = query.queryKey;
                        const filters = key[2] as Record<string, unknown> | undefined;
                        if (!filters) return true;
                        return !filters.cursor || filters.direction === 'first';
                    },
                });
            } else {
                queryClient.invalidateQueries({ queryKey: options.queryKey });
            }
        };

        // Register per-event handlers
        const handlers = new Map<string, () => void>();
        events.forEach(event => {
            const handler = createHandler(event);
            handlers.set(event, handler);
            window.addEventListener(event, handler);
        });

        // Cleanup on unmount
        onCleanup(() => {
            unsubscribe(options.room);
            handlers.forEach((handler, event) => {
                window.removeEventListener(event, handler);
            });
            handlers.clear();
        });
    });
}

/**
 * useRealtimeInvalidation - Simpler hook for just invalidation
 *
 * Use when you need to invalidate queries on WS events without managing room subscription
 * (e.g., when room is already subscribed by parent)
 */
export function useRealtimeInvalidation(
    queryKey: readonly unknown[],
    events: string[] = DEFAULT_EVENTS
) {
    const queryClient = useQueryClient();

    onMount(() => {
        const handleUpdate = () => {
            queryClient.invalidateQueries({ queryKey });
        };

        events.forEach(event => {
            window.addEventListener(event, handleUpdate);
        });

        onCleanup(() => {
            events.forEach(event => {
                window.removeEventListener(event, handleUpdate);
            });
        });
    });
}
