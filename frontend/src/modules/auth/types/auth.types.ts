/**
 * auth.types.ts — Centralized types for Auth module
 *
 * User type unified with ProfileDto (single source of truth).
 * No more manual interfaces — everything derived from shared DTOs.
 */
import type { ProfileDto } from '@app/schema/profile-dto';
import type { AuthUserResponseType } from '@app/schema/backend';

// User in auth store = ProfileDto shape (includes sessionId after getMe/login merge)
export type User = ProfileDto;

// Login response: user (without sessionId) at root + sessionId separate
export interface LoginResponse {
    user: AuthUserResponseType;
    sessionId: string;
}

// Re-export for consumers (Login.tsx)
export { AuthError } from './auth-error';
