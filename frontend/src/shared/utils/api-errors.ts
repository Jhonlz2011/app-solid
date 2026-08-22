import { isApiError, translateError, type ApiErrorResponse } from '@app/schema/errors';

/**
 * Parse an Eden or generic error response into a typed ApiErrorResponse
 * with Spanish normalized messages.
 */
export function parseApiError(edenError: unknown): ApiErrorResponse {
    // 1. Direct ApiErrorResponse object (most common path from Eden)
    if (edenError && typeof edenError === 'object' && 'value' in edenError) {
        const val = (edenError as any).value;

        // value is already an ApiErrorResponse object
        if (isApiError(val)) {
            return {
                ...val,
                message: translateError(val.code, val.message),
            };
        }

        // value is an object with message / summary / error properties
        if (val && typeof val === 'object') {
            const code = typeof val.code === 'string' ? val.code : 'INTERNAL_ERROR';
            const rawMsg = typeof val.message === 'string' ? val.message
                : typeof val.summary === 'string' ? val.summary
                : typeof val.error === 'string' ? val.error
                : null;
            if (rawMsg) {
                return {
                    code,
                    message: translateError(code, rawMsg),
                    errors: Array.isArray(val.errors) ? val.errors : undefined,
                };
            }
        }

        // value is a JSON string from the backend
        if (typeof val === 'string') {
            try {
                const parsed = JSON.parse(val);
                if (isApiError(parsed)) {
                    return {
                        ...parsed,
                        message: translateError(parsed.code, parsed.message),
                    };
                }
                if (parsed && typeof parsed === 'object') {
                    const code = parsed.code || 'INTERNAL_ERROR';
                    const rawMsg = parsed.message || parsed.summary || parsed.error;
                    if (typeof rawMsg === 'string') {
                        return { code, message: translateError(code, rawMsg), errors: parsed.errors };
                    }
                }
            } catch {
                // Not JSON — use as plain message
                return { code: 'INTERNAL_ERROR', message: translateError(undefined, val) };
            }
        }
    }

    // 2. Plain Error object
    if (edenError instanceof Error) {
        return { code: 'INTERNAL_ERROR', message: translateError(undefined, edenError.message) };
    }

    // 3. ApiErrorResponse thrown directly
    if (isApiError(edenError)) {
        return {
            ...edenError,
            message: translateError(edenError.code, edenError.message),
        };
    }

    // 4. Better-Auth client error structure: { error: { message, code } }
    if (edenError && typeof edenError === 'object' && 'error' in edenError && (edenError as any).error) {
        const inner = (edenError as any).error;
        const code = typeof inner.code === 'string' ? inner.code : undefined;
        const rawMsg = typeof inner.message === 'string' ? inner.message : undefined;
        return {
            code: code || 'AUTH_ERROR',
            message: translateError(code, rawMsg),
        };
    }

    // 5. Loose object with message / error / summary
    if (edenError && typeof edenError === 'object') {
        const obj = edenError as any;
        const code = typeof obj.code === 'string' ? obj.code : 'INTERNAL_ERROR';
        const rawMsg = typeof obj.message === 'string' ? obj.message
            : typeof obj.summary === 'string' ? obj.summary
            : typeof obj.error === 'string' ? obj.error
            : null;
        if (rawMsg) {
            return {
                code,
                message: translateError(code, rawMsg),
                errors: Array.isArray(obj.errors) ? obj.errors : undefined,
            };
        }
    }

    // 6. String
    if (typeof edenError === 'string') {
        return { code: 'INTERNAL_ERROR', message: translateError(undefined, edenError) };
    }

    // 7. Fallback
    return { code: 'INTERNAL_ERROR', message: 'Ocurrió un error inesperado en el servidor' };
}

/**
 * Extrae y traduce cualquier tipo de error (Better Auth, Eden, Fetch, Error) a un mensaje amigable en español.
 */
export function getFriendlyErrorMessage(error: unknown, fallback = 'Ocurrió un error inesperado'): string {
    if (!error) return fallback;

    if (error instanceof ApiError) {
        return error.message;
    }

    const parsed = parseApiError(error);
    return parsed.message || fallback;
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

/**
 * Detecta si un error es de red (sin conexión) vs un error de API del servidor.
 * Útil para mostrar feedback diferenciado en formularios offline.
 */
export function isNetworkError(error: unknown): boolean {
  if (error instanceof TypeError && error.message === 'Failed to fetch') return true;
  if (error instanceof DOMException && error.name === 'AbortError') return true;
  // Eden envuelve errores de red en un objeto con .value = TypeError
  if (error && typeof error === 'object' && 'value' in error) {
    const inner = (error as any).value;
    if (inner instanceof TypeError && inner.message === 'Failed to fetch') return true;
  }
  return false;
}

