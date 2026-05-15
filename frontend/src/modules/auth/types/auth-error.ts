/**
 * AuthError — Structured error class for auth operations.
 * Parses backend error responses into human-readable messages.
 */
export class AuthError extends Error {
    constructor(input: unknown, defaultMsg: string = 'Error de autenticación') {
        super(AuthError.parse(input, defaultMsg));
        this.name = 'AuthError';
    }

    private static parse(input: unknown, fallback: string): string {
        if (typeof input === 'string') return input;
        if (typeof input === 'object' && input !== null) {
            const obj = input as Record<string, unknown>;
            if (typeof obj.error === 'string') return obj.error;
            if (typeof obj.summary === 'string') return obj.summary;
            if (typeof obj.message === 'string') return obj.message;
        }
        return fallback;
    }
}
