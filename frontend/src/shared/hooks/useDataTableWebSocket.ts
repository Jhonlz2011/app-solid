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
import { WsEvents, type EntityEventPayload } from '@app/schema/ws-events';
import { clientId } from '../lib/eden';

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
         * - IGNORE: if the event was triggered by our own clientId (handled optimistically by TanStack Query mutations)
         * - CREATED: only invalidates first-page queries (cursor pagination optimization)
         * - UPDATED: localized cache injection without network refetch
         * - DELETED: localized slice removal without network refetch
         */
        const createHandler = (eventName: string) => (e: Event) => {
            const customEvent = e as CustomEvent<EntityEventPayload>;
            const eventData = customEvent.detail;

            // 1) Ignore events triggered by our own client (already handled by optimistic updates)
            if (eventData?.clientId === clientId) return;

            if (eventName === WsEvents.ENTITY.CREATED) {
                // For new items, we invalidate the first page so it appears at the top
                queryClient.invalidateQueries({
                    queryKey: options.queryKey,
                    predicate: (query) => {
                        const key = query.queryKey;
                        const filters = key[2] as Record<string, unknown> | undefined;
                        if (!filters) return true;
                        return !filters.cursor || filters.direction === 'first';
                    },
                });
            } else if (eventName === WsEvents.ENTITY.UPDATED && eventData?.entity) {
                // Localized cache update: replace the entity in existing lists
                queryClient.setQueriesData({ queryKey: options.queryKey }, (old: any) => {
                    if (!old || !old.data) return old;
                    return {
                        ...old,
                        data: old.data.map((item: any) => 
                            item.id === eventData.entity!.id ? { ...item, ...eventData.entity } : item
                        )
                    };
                });
                
                // Also invalidate the detail query for this specific entity
                if (options.queryKey.length > 0 && typeof options.queryKey[0] === 'string') {
                    // e.g. ['suppliers', 'detail', 123]
                    const rootKey = options.queryKey[0];
                    queryClient.invalidateQueries({ queryKey: [rootKey, 'detail', eventData.entity.id] });
                }
            } else if (eventName === WsEvents.ENTITY.DELETED) {
                // Localized cache removal: filter out the deleted ID(s)
                const idsToRemove = eventData?.ids || (eventData?.id ? [eventData.id] : []);
                if (idsToRemove.length === 0) return;
                
                queryClient.setQueriesData({ queryKey: options.queryKey }, (old: any) => {
                    if (!old || !old.data) return old;
                    const idSet = new Set(idsToRemove);
                    return {
                        ...old,
                        data: old.data.filter((item: any) => !idSet.has(item.id)),
                        meta: { ...old.meta, total: Math.max(0, old.meta.total - idsToRemove.length) }
                    };
                });
            } else {
                // Fallback for unknown events (or 'ws:connected' recovery)
                queryClient.invalidateQueries({ queryKey: options.queryKey });
            }
        };

        // Register per-event handlers + the global WS recovery event
        const handlers = new Map<string, (e: Event) => void>();
        const allEvents = [...events, 'ws:connected'];
        
        allEvents.forEach(event => {
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
        const handleUpdate = (e: Event) => {
            const customEvent = e as CustomEvent<EntityEventPayload>;
            const eventData = customEvent.detail;
            
            // Ignore events triggered by our own client
            if (eventData?.clientId === clientId) return;

            queryClient.invalidateQueries({ queryKey });
        }

        const allEvents = [...events, 'ws:connected'];

        allEvents.forEach(event => {
            window.addEventListener(event, handleUpdate);
        });

        onCleanup(() => {
            allEvents.forEach(event => {
                window.removeEventListener(event, handleUpdate);
            });
        });
    });
}
