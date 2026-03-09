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

// import { onMount, onCleanup } from 'solid-js';
// import { useQueryClient } from '@tanstack/solid-query';
// import { subscribe, unsubscribe } from '../store/sse.store';
// import { RealtimeEvents, type EntityEventPayload } from '@app/schema/realtime-events';
// import { clientId } from '../lib/eden';
// import { removeCacheItems, updateCacheItem, cacheContainsItem } from '../utils/query.utils';

// const DEFAULT_EVENTS = [
//     RealtimeEvents.ENTITY.CREATED,
//     RealtimeEvents.ENTITY.UPDATED,
//     RealtimeEvents.ENTITY.DELETED,
// ];

// interface UseDataTableWebSocketOptions {
//     /** WebSocket room to subscribe to */
//     room: string;
//     /** TanStack Query key(s) to invalidate on events */
//     queryKey: readonly unknown[];
//     /** Custom events to listen for (defaults to entity CRUD events) */
//     events?: string[];
//     /** Whether the subscription is enabled */
//     enabled?: boolean;
// }

// export function useDataTableWebSocket(options: UseDataTableWebSocketOptions) {
//     const queryClient = useQueryClient();
//     const events = options.events ?? DEFAULT_EVENTS;
//     const enabled = options.enabled ?? true;

//     onMount(() => {
//         if (!enabled) return;

//         // Subscribe to WebSocket room
//         subscribe(options.room);

//         /**
//          * Smart invalidation handler:
//          * - IGNORE: if the event was triggered by our own clientId (handled optimistically by TanStack Query mutations)
//          * - CREATED: only invalidates first-page queries (cursor pagination optimization)
//          * - UPDATED: localized cache injection without network refetch
//          * - DELETED: localized slice removal without network refetch
//          */
//         const createHandler = (eventName: string) => (e: Event) => {
//             const customEvent = e as CustomEvent<EntityEventPayload>;
//             const eventData = customEvent.detail;

//             // 1) Allow events triggered by our own client to process.
//             // Since we rely on the WS for instant soft-delete transitions, 
//             // the initiating tab needs this to hide the row instantly.
//             // (Optimistic mutations will just silently co-exist or get overwritten cleanly).

//             if (eventName === RealtimeEvents.ENTITY.CREATED) {
//                 // For new items, we invalidate the first page so it appears at the top
//                 queryClient.invalidateQueries({
//                     queryKey: options.queryKey,
//                     predicate: (query) => {
//                         const key = query.queryKey;
//                         const filters = key[2] as Record<string, unknown> | undefined;
//                         if (!filters) return true;
//                         return !filters.cursor || filters.direction === 'first';
//                     },
//                 });
//             } else if (eventName === RealtimeEvents.ENTITY.UPDATED && eventData?.entity) {
//                 // Localized cache update: replace the entity in existing lists,
//                 // OR logically filter it out if it transitioned between active/inactive
//                 const matchingQueries = queryClient.getQueriesData({ queryKey: options.queryKey });
                
//                 matchingQueries.forEach(([queryKey, oldData]: [any, any]) => {
//                     if (!oldData || (!oldData.data && !oldData.pages)) return;
                    
//                     const filters = queryKey[2] as Record<string, unknown> | undefined;
//                     const isActiveArr = filters?.isActive as string[] | undefined;
                    
//                     // In our backend architecture, if no isActive filter is provided, 
//                     // it defaults to showing ONLY active entities.
//                     const isStrictlyActive = (!isActiveArr || isActiveArr.length === 0) || 
//                                              (isActiveArr.length === 1 && isActiveArr[0] === 'true');
                                             
//                     const isStrictlyInactive = isActiveArr?.length === 1 && isActiveArr[0] === 'false';
//                     const entityIsActive = Boolean(eventData.entity!.is_active);
                    
//                     queryClient.setQueryData(queryKey, (old: any) => {
//                         if (!old || (!old.data && !old.pages)) return old;

//                         // 1. If query strictly asks for active only, and entity is now inactive → REMOVE
//                         if (isStrictlyActive && !entityIsActive) {
//                             return removeCacheItems(old, [eventData.entity!.id as number]);
//                         }
                        
//                         // 2. If query strictly asks for inactive only, and entity is now active → REMOVE
//                         if (isStrictlyInactive && entityIsActive) {
//                             return removeCacheItems(old, [eventData.entity!.id as number]);
//                         }

//                         // 3. Otherwise, check if we currently have it in the array
//                         const exists = cacheContainsItem(old, eventData.entity!.id as number);
                        
//                         if (exists) {
//                             // Just update it inline
//                             return updateCacheItem(old, eventData.entity as any);
//                         }

//                         // 4. Missing but SHOULD be here (e.g. was active, we are looking at inactive, and it just got deactivated).
//                         // We simply trigger an invalidation to cleanly fetch the page slice in the background.
//                         if ((isStrictlyInactive && !entityIsActive) || (isStrictlyActive && entityIsActive)) {
//                             setTimeout(() => queryClient.invalidateQueries({ queryKey }), 0);
//                         }

//                         return old;
//                     });
//                 });
                
//                 // Also invalidate the detail query for this specific entity
//                 if (options.queryKey.length > 0 && typeof options.queryKey[0] === 'string') {
//                     // e.g. ['suppliers', 'detail', 123]
//                     const rootKey = options.queryKey[0];
//                     queryClient.invalidateQueries({ queryKey: [rootKey, 'detail', eventData.entity.id as number] });
//                 }
//             } else if (eventName === RealtimeEvents.ENTITY.DELETED) {
//                 // Localized cache removal: filter out the deleted ID(s)
//                 const idsToRemove = eventData?.ids || (eventData?.id ? [eventData.id] : []);
//                 if (idsToRemove.length === 0) return;
                
//                 queryClient.setQueriesData({ queryKey: options.queryKey }, (old: any) => {
//                     return removeCacheItems(old, idsToRemove);
//                 });
//             } else {
//                 // Fallback for unknown events (or 'ws:connected' recovery)
//                 queryClient.invalidateQueries({ queryKey: options.queryKey });
//             }
//         };

//         // Register per-event handlers + the global WS recovery event
//         const handlers = new Map<string, (e: Event) => void>();
//         const allEvents = [...events, 'ws:connected'];
        
//         allEvents.forEach(event => {
//             const handler = createHandler(event);
//             handlers.set(event, handler);
//             window.addEventListener(event, handler);
//         });

//         // Cleanup on unmount
//         onCleanup(() => {
//             unsubscribe(options.room);
//             handlers.forEach((handler, event) => {
//                 window.removeEventListener(event, handler);
//             });
//             handlers.clear();
//         });
//     });
// }

// /**
//  * useRealtimeInvalidation - Simpler hook for just invalidation
//  *
//  * Use when you need to invalidate queries on WS events without managing room subscription
//  * (e.g., when room is already subscribed by parent)
//  */
// export function useRealtimeInvalidation(
//     queryKey: readonly unknown[],
//     events: string[] = DEFAULT_EVENTS
// ) {
//     const queryClient = useQueryClient();

//     onMount(() => {
//         const handleUpdate = (e: Event) => {
//             const customEvent = e as CustomEvent<EntityEventPayload>;
//             const eventData = customEvent.detail;
            
//             // Ignore events triggered by our own client
//             if (eventData?.clientId === clientId) return;

//             // Invalidate all queries beneath this key (hierarchical/prefix match)
//             queryClient.invalidateQueries({ queryKey, exact: false });
//         }

//         const allEvents = [...events, 'ws:connected'];

//         allEvents.forEach(event => {
//             window.addEventListener(event, handleUpdate);
//         });

//         onCleanup(() => {
//             allEvents.forEach(event => {
//                 window.removeEventListener(event, handleUpdate);
//             });
//         });
//     });
// }
