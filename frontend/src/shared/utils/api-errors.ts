import { isApiError, type ApiErrorResponse } from '@app/schema/errors';

/**
 * Parse an Eden error response into a typed ApiErrorResponse.
 *
 * Eden's `error.value` can be:
 * - An object (already our ApiErrorResponse shape from the backend)
 * - A string (JSON-encoded or plain text)
 * - null/undefined
 *
 * This utility normalises all cases into a single ApiErrorResponse shape
 * that can be consumed by TanStack Form's setFieldMeta.
 */
export function parseApiError(edenError: unknown): ApiErrorResponse {
    // 1. Direct ApiErrorResponse object (most common path from Eden)
    if (edenError && typeof edenError === 'object' && 'value' in edenError) {
        const val = (edenError as any).value;

        // value is already an ApiErrorResponse object
        if (isApiError(val)) return val;

        // value is a JSON string from the backend
        if (typeof val === 'string') {
            try {
                const parsed = JSON.parse(val);
                if (isApiError(parsed)) return parsed;
            } catch {
                // Not JSON — use as plain message
                return { code: 'INTERNAL_ERROR', message: val };
            }
        }
    }

    // 2. Plain Error object
    if (edenError instanceof Error) {
        return { code: 'INTERNAL_ERROR', message: edenError.message };
    }

    // 3. ApiErrorResponse thrown directly
    if (isApiError(edenError)) return edenError;

    // 4. String
    if (typeof edenError === 'string') {
        return { code: 'INTERNAL_ERROR', message: edenError };
    }

    // 5. Fallback
    return { code: 'INTERNAL_ERROR', message: 'Error desconocido del servidor' };
}

/**
 * Helper class that wraps ApiErrorResponse to work with catch blocks
 * that check `instanceof Error`.
 */
export class ApiError extends Error {
    public readonly apiError: ApiErrorResponse;

    constructor(response: ApiErrorResponse) {
        super(response.message);
        this.name = 'ApiError';
        this.apiError = response;
    }

    get code() { return this.apiError.code; }
    get errors() { return this.apiError.errors; }
}

/**
 * Parse Eden error and throw as ApiError (extends Error).
 * Use in mutation hooks: `if (error) throw throwApiError(error)`
 */
export function throwApiError(edenError: unknown): never {
    throw new ApiError(parseApiError(edenError));
}
