/**
 * useDataTableSSE - Hook for DataTable SSE subscriptions
 *
 * Subscribes to a SSE room and auto-invalidates TanStack Query
 * when entity events are received. Uses smart invalidation:
 * - 'created' → invalidates only first-page queries (new item at top)
 * - 'updated' / 'deleted' → invalidates all list queries
 *
 * @example
 * useDataTableSSE({ room: 'suppliers', queryKey: supplierKeys.lists() });
 */
import { onMount, onCleanup } from 'solid-js';
import { useQueryClient } from '@tanstack/solid-query';
import { subscribe, unsubscribe } from '../store/sse.store';
import { RealtimeEvents, type EntityEventPayload } from '@app/schema/realtime-events';
import { clientId } from '../lib/eden';
import { removeCacheItems, updateCacheItem, cacheContainsItem } from '../utils/query.utils';

const DEFAULT_EVENTS = [
    RealtimeEvents.ENTITY.CREATED,
    RealtimeEvents.ENTITY.UPDATED,
    RealtimeEvents.ENTITY.DELETED,
];

interface UseDataTableSSEOptions {
    /** SSE room to subscribe to */
    room: string;
    /** TanStack Query key(s) to invalidate on events */
    queryKey: readonly unknown[];
    /** Custom events to listen for (defaults to entity CRUD events) */
    events?: string[];
    /** Whether the subscription is enabled */
    enabled?: boolean;
}

export function useDataTableSSE(options: UseDataTableSSEOptions) {
    const queryClient = useQueryClient();
    const events = options.events ?? DEFAULT_EVENTS;
    const enabled = options.enabled ?? true;

    onMount(() => {
        if (!enabled) return;

        // Subscribe to SSE room
        subscribe(options.room);

        const createHandler = (eventName: string) => (e: Event) => {
            const customEvent = e as CustomEvent<EntityEventPayload>;
            const eventData = customEvent.detail;

            if (eventName === RealtimeEvents.ENTITY.CREATED) {
                queryClient.invalidateQueries({
                    queryKey: options.queryKey,
                    predicate: (query) => {
                        const key = query.queryKey;
                        const filters = key[2] as Record<string, unknown> | undefined;
                        if (!filters) return true;
                        return !filters.cursor || filters.direction === 'first';
                    },
                });
            } else if (eventName === RealtimeEvents.ENTITY.UPDATED && eventData?.entity) {
                const matchingQueries = queryClient.getQueriesData({ queryKey: options.queryKey });
                
                matchingQueries.forEach(([queryKey, oldData]: [any, any]) => {
                    if (!oldData || (!oldData.data && !oldData.pages)) return;
                    
                    const filters = queryKey[2] as Record<string, unknown> | undefined;
                    const isActiveArr = filters?.isActive as string[] | undefined;
                    
                    const isStrictlyActive = (!isActiveArr || isActiveArr.length === 0) || 
                                             (isActiveArr.length === 1 && isActiveArr[0] === 'true');
                                             
                    const isStrictlyInactive = isActiveArr?.length === 1 && isActiveArr[0] === 'false';
                    const entityIsActive = Boolean(eventData.entity!.is_active);
                    
                    queryClient.setQueryData(queryKey, (old: any) => {
                        if (!old || (!old.data && !old.pages)) return old;

                        if (isStrictlyActive && !entityIsActive) {
                            return removeCacheItems(old, [eventData.entity!.id as number]);
                        }
                        
                        if (isStrictlyInactive && entityIsActive) {
                            return removeCacheItems(old, [eventData.entity!.id as number]);
                        }

                        const exists = cacheContainsItem(old, eventData.entity!.id as number);
                        
                        if (exists) {
                            return updateCacheItem(old, eventData.entity as any);
                        }

                        if ((isStrictlyInactive && !entityIsActive) || (isStrictlyActive && entityIsActive)) {
                            setTimeout(() => queryClient.invalidateQueries({ queryKey }), 0);
                        }

                        return old;
                    });
                });
                
                if (options.queryKey.length > 0 && typeof options.queryKey[0] === 'string') {
                    const rootKey = options.queryKey[0];
                    queryClient.invalidateQueries({ queryKey: [rootKey, 'detail', eventData.entity.id as number] });
                }
            } else if (eventName === RealtimeEvents.ENTITY.DELETED) {
                const idsToRemove = eventData?.ids || (eventData?.id ? [eventData.id] : []);
                if (idsToRemove.length === 0) return;
                
                queryClient.setQueriesData({ queryKey: options.queryKey }, (old: any) => {
                    return removeCacheItems(old, idsToRemove);
                });
            } else {
                queryClient.invalidateQueries({ queryKey: options.queryKey });
            }
        };

        const handlers = new Map<string, (e: Event) => void>();
        const allEvents = [...events, 'sse:connected'];
        
        allEvents.forEach(event => {
            const handler = createHandler(event);
            handlers.set(event, handler);
            window.addEventListener(event, handler);
        });

        onCleanup(() => {
            unsubscribe(options.room);
            handlers.forEach((handler, event) => {
                window.removeEventListener(event, handler);
            });
            handlers.clear();
        });
    });
}

export function useRealtimeInvalidation(
    queryKey: readonly unknown[],
    events: string[] = DEFAULT_EVENTS
) {
    const queryClient = useQueryClient();

    onMount(() => {
        const handleUpdate = (e: Event) => {
            const customEvent = e as CustomEvent<EntityEventPayload>;
            const eventData = customEvent.detail;
            
            if (eventData?.clientId === clientId) return;

            queryClient.invalidateQueries({ queryKey, exact: false });
        }

        const allEvents = [...events, 'sse:connected'];

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
