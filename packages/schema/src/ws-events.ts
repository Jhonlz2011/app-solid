/**
 * WebSocket Events - Shared type definitions
 * 
 * Used by both frontend and backend for type-safe event handling.
 */

export const WsEvents = {
    ENTITY: {
        CREATED: 'entity:created',
        UPDATED: 'entity:updated',
        DELETED: 'entity:deleted',
    },
    ROOMS: {
        SUPPLIERS: 'suppliers',
        CLIENTS: 'clients',
        PRODUCTS: 'products',
        EMPLOYEES: 'employees',
        CARRIERS: 'carriers',
    },
} as const;

// Type helpers
export type WsEventType = typeof WsEvents;
export type EntityEvent = typeof WsEvents.ENTITY[keyof typeof WsEvents.ENTITY];
export type RoomName = typeof WsEvents.ROOMS[keyof typeof WsEvents.ROOMS];

// Event payload types
export interface EntityEventPayload {
    type: 'supplier' | 'client' | 'employee' | 'carrier';
    entity?: Record<string, unknown>;
    id?: number;
    ids?: number[];
}

export interface WsMessage<T = unknown> {
    event: string;
    data: T;
    room?: string;
}
