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
    USER: {
        PROFILE_UPDATED: 'user:profile_updated',
        SESSION_REVOKED: 'user:session_revoked',
        SESSION_CREATED: 'user:session_created',
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

// Payload for user profile update (targeted to personal room user:{id})
export interface UserProfileUpdatedPayload {
    userId: number;
    username?: string;
    email?: string;
}

export interface WsMessage<T = unknown> {
    event: string;
    data: T;
    room?: string;
}
