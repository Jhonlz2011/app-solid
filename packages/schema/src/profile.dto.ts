// ============================================================================
// PROFILE Response DTOs — Single source of truth for Profile/Auth API
// Derived from auth.service.ts actual return shapes
// ============================================================================

// Re-export session type from RBAC (same shape for profile and admin)
export type { UserSessionDto as SessionDto } from './rbac.dto';
export type { SuccessDto } from './rbac.dto';

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
    id: number;
    companyId: number;
    companySlug?: string;
    email: string;
    username: string;
    entityId: number | null;
    isActive: boolean | null;
    lastLogin: Date | null;
    emailVerifiedAt: string | Date | null;
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
        id: number;
        email: string;
        username: string;
    };
}
