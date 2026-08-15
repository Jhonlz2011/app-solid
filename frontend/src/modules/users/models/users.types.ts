/**
 * Module-specific Eden-derived types for body payloads.
 */
import { api } from '@shared/lib/eden';

// ─── Eden-derived types (body payloads inferred from route contracts) ──────
export type RoleBody = Parameters<typeof api.api.rbac.roles.post>[0];