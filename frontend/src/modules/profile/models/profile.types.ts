// Profile Types for My Account Page

export interface Profile {
    id: number;
    email: string;
    username: string;
    entityId: number | null;
    isActive: boolean;
    lastLogin: string | null;
    roles: string[];
    permissions: string[];
    entity: {
        id: number;
        businessName: string;
        isClient: boolean;
        isSupplier: boolean;
        isEmployee: boolean;
    } | null;
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
