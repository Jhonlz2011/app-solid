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
        RBAC_CHANGED: 'user:rbac_changed',
        EMAIL_VERIFIED: 'user:email_verified',
    },
    COMPANY: {
        BRANDING_UPDATED: 'company:branding_updated',
        PROFILE_UPDATED: 'company:profile_updated',
        FISCAL_UPDATED: 'company:fiscal_updated',
    },
    VEHICLE: {
        CREATED: 'vehicle:created',
        UPDATED: 'vehicle:updated',
        DELETED: 'vehicle:deleted',
    },
    WAREHOUSE: {
        CREATED: 'warehouse:created',
        UPDATED: 'warehouse:updated',
        DELETED: 'warehouse:deleted',
    },
    ROOMS: {
        SUPPLIERS: 'suppliers',
        CLIENTS: 'clients',
        PRODUCTS: 'products',
        EMPLOYEES: 'employees',
        CARRIERS: 'carriers',
        USERS: 'users',
        LOCATIONS: 'locations',
        CATEGORIES: 'categories',
        ATTRIBUTES: 'attributes',
        BRANDS: 'brands',
        UOM: 'uom',
        VEHICLES: 'vehicles',
        WAREHOUSES: 'warehouses',
    },
} as const;

// Type helpers
export type RealtimeEventType = typeof RealtimeEvents;
export type EntityEvent = typeof RealtimeEvents.ENTITY[keyof typeof RealtimeEvents.ENTITY];
export type UserEvent = typeof RealtimeEvents.USER[keyof typeof RealtimeEvents.USER];
export type CompanyEvent = typeof RealtimeEvents.COMPANY[keyof typeof RealtimeEvents.COMPANY];
export type VehicleEvent = typeof RealtimeEvents.VEHICLE[keyof typeof RealtimeEvents.VEHICLE];
export type WarehouseEvent = typeof RealtimeEvents.WAREHOUSE[keyof typeof RealtimeEvents.WAREHOUSE];
export type RoomName = typeof RealtimeEvents.ROOMS[keyof typeof RealtimeEvents.ROOMS];

// Payload types
export interface BaseEventPayload<TEntity = Record<string, unknown>> {
    id?: number;
    ids?: number[];
    entity?: TEntity;
    clientId?: string;
    type?: string;
    // Explicit user ID for targeted routing or audit
    userId?: string | number;
}

export type EntityEventPayload<TEntity = Record<string, unknown>> = BaseEventPayload<TEntity> & {
    type?: 'supplier' | 'client' | 'employee' | 'carrier' | 'attribute' | 'brand' | 'category' | 'uom' | 'product' | 'location';
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

/**
 * Generates tenant-scoped room name: `company:{companyId}:{room}`
 */
export function getTenantRoom(companyId: number | string, room: string): string {
    return `company:${companyId}:${room}`;
}

/**
 * Generates company root room name: `company:{companyId}`
 */
export function getCompanyRoom(companyId: number | string): string {
    return `company:${companyId}`;
}

/**
 * Generates user personal room name: `user:{userId}`
 */
export function getUserRoom(userId: number | string): string {
    return `user:${userId}`;
}
