// ============================================================================
// PROFILE Response DTOs — Single source of truth for Profile/Auth API
// Derived from auth.service.ts actual return shapes
// ============================================================================
// --- Profile Entity (from mapEntity — auth.service.ts L19-27) ---
export interface ProfileEntityDto {
    id: number;
    businessName: string;
    isClient: boolean;
    isSupplier: boolean;
    isEmployee: boolean;
}

// --- Profile / Me (from getMe — auth.service.ts L272-303 + route L94) ---
export interface ProfileDto {
    id: string | number;
    companyId: number;
    companySlug?: string | null;
    email: string;
    username?: string | null;
    entityId?: number | null;
    isActive?: boolean | null;
    lastLogin?: Date | null;
    emailVerified?: boolean;
    emailVerifiedAt?: string | Date | null;
    roles: string[];
    permissions: string[];
    entity?: ProfileEntityDto;
    sessionId: string;
}

// --- Update Profile Response (from updateProfile — auth.service.ts L331-355) ---
export interface UpdateProfileResponseDto {
    success: true;
    message?: string;
    user?: {
        id: string | number;
        email: string;
        username: string;
    };
}
