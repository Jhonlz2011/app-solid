/**
 * Realtime Events - Shared type definitions for SSE/Redis
 * 
 * Used by both frontend and backend for type-safe event handling.
 */

export const RealtimeEvents = {
    ENTITY: {
        CREATED: 'entity:created',
        UPDATED: 'entity:updated',
        DELETED: 'entity:deleted',
    },
    USER: {
        CREATED: 'user:created',
        UPDATED: 'user:updated',
        DELETED: 'user:deleted',
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
        USERS: 'users',
    },
} as const;

// Type helpers
export type RealtimeEventType = typeof RealtimeEvents;
export type EntityEvent = typeof RealtimeEvents.ENTITY[keyof typeof RealtimeEvents.ENTITY];
export type UserEvent = typeof RealtimeEvents.USER[keyof typeof RealtimeEvents.USER];
export type RoomName = typeof RealtimeEvents.ROOMS[keyof typeof RealtimeEvents.ROOMS];

// Payload types
export interface EntityEventPayload {
    type: 'supplier' | 'client' | 'employee' | 'carrier';
    entity?: Record<string, unknown>;
    id?: number;
    ids?: number[];
    clientId?: string; // The client that initiated the change (for optimistic UI syncing)
}

// Payload for user CRUD events (targeted to room 'users')
export interface UserEventPayload {
    userId: number;
    entity?: Record<string, unknown>;
    clientId?: string;
}

// Payload for user profile update (targeted to personal room user:{id})
export interface UserProfileUpdatedPayload {
    userId: number;
    username?: string;
    email?: string;
}

export interface RealtimeMessage<T = unknown> {
    event: string;
    data: T;
    room?: string;
}
