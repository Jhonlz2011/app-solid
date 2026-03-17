import { Type, type Static } from '@sinclair/typebox';

// ============================================================================
// Error Codes — Single source of truth for API error classification
// ============================================================================

export const API_ERROR_CODES = {
    VALIDATION_ERROR: 'VALIDATION_ERROR',
    DUPLICATE_ENTRY: 'DUPLICATE_ENTRY',
    NOT_FOUND: 'NOT_FOUND',
    FORBIDDEN: 'FORBIDDEN',
    UNAUTHORIZED: 'UNAUTHORIZED',
    CONFLICT: 'CONFLICT',
    INTERNAL_ERROR: 'INTERNAL_ERROR',
} as const;

export type ApiErrorCode = (typeof API_ERROR_CODES)[keyof typeof API_ERROR_CODES];

// ============================================================================
// TypeBox schemas (for Elysia response validation)
// ============================================================================

export const ApiFieldErrorSchema = Type.Object({
    field: Type.String(),
    message: Type.String(),
});

export const ApiErrorResponseSchema = Type.Object({
    code: Type.String(),
    message: Type.String(),
    errors: Type.Optional(Type.Array(ApiFieldErrorSchema)),
});

// ============================================================================
// TypeScript types (for frontend consumption — no TypeBox dependency needed)
// ============================================================================

export type ApiFieldError = Static<typeof ApiFieldErrorSchema>;
export type ApiErrorResponse = Static<typeof ApiErrorResponseSchema>;

/** Type guard to check if an unknown value is an ApiErrorResponse */
export function isApiError(value: unknown): value is ApiErrorResponse {
    return (
        typeof value === 'object' &&
        value !== null &&
        'code' in value &&
        'message' in value &&
        typeof (value as any).code === 'string' &&
        typeof (value as any).message === 'string'
    );
}
