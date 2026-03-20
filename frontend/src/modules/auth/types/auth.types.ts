import type { AuthLoginDto } from '@app/schema/frontend';
import type { AuthUserResponseType } from '@app/schema/backend';

// Inferred from shared schema — stays in sync with backend automatically
export type User = AuthUserResponseType & {
    sessionId?: string;  // Returned by /me for WS revoke comparison
};

export type LoginRequest = AuthLoginDto;

export interface LoginResponse {
    user: User;
    sessionId: string;
}

export interface ApiError {
    error: string;
    message?: string;
}

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
