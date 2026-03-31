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
export interface BaseEventPayload<TEntity = Record<string, unknown>> {
    id?: number;
    ids?: number[];
    entity?: TEntity;
    clientId?: string;
    type?: string;
    // For backwards compatibility or explicit manual overrides
    userId?: number;
}

export type EntityEventPayload<TEntity = Record<string, unknown>> = BaseEventPayload<TEntity> & {
    type: 'supplier' | 'client' | 'employee' | 'carrier';
};

export type UserEventPayload<TUser = Record<string, unknown>> = BaseEventPayload<TUser>;

// Payload for user profile update (targeted to personal room user:{id})
export interface UserProfileUpdatedPayload extends BaseEventPayload {
    username?: string;
    email?: string;
}

export interface RealtimeMessage<T = unknown> {
    event: string;
    data: T;
    room?: string;
}
