/**
 * profile.types.ts — Centralized Types for Profile module
 *
 * All types re-exported from @app/schema shared DTOs.
 */

// ─── Re-exports from shared DTOs (single source of truth) ──────────────────
export type { ProfileDto as Profile } from '@app/schema/profile-dto';
export type { ProfileEntityDto as ProfileEntity } from '@app/schema/profile-dto';
export type { UpdateProfileResponseDto as UpdateProfileResponse } from '@app/schema/profile-dto';
export type { SessionDto as Session } from '@app/schema/profile-dto';
export type { SuccessDto } from '@app/schema/profile-dto';
