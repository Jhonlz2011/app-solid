// Profile Types for My Account Page

import type { Entity } from '@app/schema/types';

export interface Profile {
    id: number;
    email: string;
    username: string;
    entityId: number | null;
    isActive: boolean;
    lastLogin: string | null;
    roles: string[];
    permissions: string[];
    entity: Entity | null;
}

export interface UpdateProfileRequest {
    username?: string;
    email?: string;
}

export interface UpdateProfileResponse {
    success: boolean;
    message?: string;
    user?: {
        id: number;
        email: string;
        username: string;
    };
}

export interface ChangePasswordRequest {
    currentPassword: string;
    newPassword: string;
}

export interface ChangePasswordResponse {
    success: boolean;
}
