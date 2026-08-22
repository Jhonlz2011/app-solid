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
// Spanish Error Dictionary — Enterprise-grade translation for Auth, DB & Network
// ============================================================================

export const ERROR_MESSAGES_ES: Record<string, string> = {
    // Better Auth & Authentication
    INVALID_EMAIL_OR_PASSWORD: 'Correo electrónico o contraseña incorrectos',
    USER_NOT_FOUND: 'No se encontró ninguna cuenta con estos datos',
    EMAIL_ALREADY_EXISTS: 'Este correo electrónico ya está registrado',
    USER_ALREADY_EXISTS: 'Este correo electrónico ya está registrado',
    USERNAME_IS_ALREADY_TAKEN: 'Este nombre de usuario ya está en uso',
    USERNAME_ALREADY_EXISTS: 'Este nombre de usuario ya está en uso',
    INVALID_PASSWORD: 'La contraseña ingresada es incorrecta',
    PASSWORD_TOO_SHORT: 'La contraseña debe tener al menos 8 caracteres',
    PASSWORD_TOO_LONG: 'La contraseña excede la longitud máxima permitida',
    INVALID_TOKEN: 'El enlace de verificación es inválido o ya fue utilizado',
    TOKEN_EXPIRED: 'El enlace de verificación ha expirado. Por favor, solicita uno nuevo.',
    FAILED_TO_CREATE_USER: 'No se pudo crear la cuenta de usuario',
    FAILED_TO_CREATE_SESSION: 'No se pudo iniciar la sesión',
    ORGANIZATION_NOT_FOUND: 'La empresa solicitada no existe o no tienes acceso',
    USER_IS_NOT_A_MEMBER_OF_THE_ORGANIZATION: 'No perteneces a la empresa seleccionada',
    YOU_ARE_NOT_ALLOWED_TO_INVITE_USER: 'No tienes permisos para invitar a otros usuarios',
    TWO_FACTOR_REQUIRED: 'Se requiere código de autenticación de dos factores',
    INVALID_TWO_FACTOR_CODE: 'El código de autenticación es incorrecto',
    INVALID_OTP: 'El código de verificación es incorrecto',
    TOO_MANY_REQUESTS: 'Demasiadas peticiones. Por favor, espera un momento antes de volver a intentar.',
    SESSION_EXPIRED: 'Tu sesión ha expirado. Por favor, inicia sesión nuevamente.',
    UNAUTHORIZED: 'Debes iniciar sesión para realizar esta acción',
    FORBIDDEN: 'No tienes permisos suficientes para realizar esta acción',
    VALIDATION_ERROR: 'Los datos proporcionados no son válidos',
    DUPLICATE_ENTRY: 'Ya existe un registro con estos datos',
    NOT_FOUND: 'El recurso solicitado no fue encontrado',
    CONFLICT: 'No se puede completar la operación debido a un conflicto con otros registros',
    INTERNAL_ERROR: 'Ocurrió un error inesperado en el servidor',
};

/**
 * Normaliza y traduce códigos o mensajes de error en inglés hacia español fluido.
 */
export function translateError(code?: string | null, rawMessage?: string | null): string {
    // 1. Coincidencia directa por código
    if (code && ERROR_MESSAGES_ES[code]) {
        return ERROR_MESSAGES_ES[code];
    }

    if (!rawMessage) {
        return ERROR_MESSAGES_ES.INTERNAL_ERROR;
    }

    const msg = rawMessage.trim();
    const lower = msg.toLowerCase();

    // 2. Coincidencias comunes de Better Auth y servicios
    if (lower.includes('invalid email or password') || lower.includes('invalid credentials')) {
        return ERROR_MESSAGES_ES.INVALID_EMAIL_OR_PASSWORD;
    }
    if (lower.includes('user not found')) {
        return ERROR_MESSAGES_ES.USER_NOT_FOUND;
    }
    if (lower.includes('email already exists') || lower.includes('user already exists')) {
        return ERROR_MESSAGES_ES.EMAIL_ALREADY_EXISTS;
    }
    if (lower.includes('username is already taken') || lower.includes('username already exists')) {
        return ERROR_MESSAGES_ES.USERNAME_IS_ALREADY_TAKEN;
    }
    if (lower.includes('invalid password')) {
        return ERROR_MESSAGES_ES.INVALID_PASSWORD;
    }
    if (lower.includes('password is too short') || lower.includes('password too short')) {
        return ERROR_MESSAGES_ES.PASSWORD_TOO_SHORT;
    }
    if (lower.includes('invalid token')) {
        return ERROR_MESSAGES_ES.INVALID_TOKEN;
    }
    if (lower.includes('token expired') || lower.includes('expired token')) {
        return ERROR_MESSAGES_ES.TOKEN_EXPIRED;
    }
    if (lower.includes('too many requests') || lower.includes('rate limit')) {
        return ERROR_MESSAGES_ES.TOO_MANY_REQUESTS;
    }
    if (lower.includes('failed to fetch') || lower.includes('networkerror') || lower.includes('econnrefused')) {
        return 'Error de conexión. Verifica tu conexión a internet o el estado del servidor.';
    }
    if (lower.includes('abort') || lower.includes('user aborted')) {
        return 'La operación fue cancelada';
    }

    // 3. Coincidencias de validación TypeBox
    if (lower.includes('expected required property') || lower.includes('required')) {
        return 'Este campo es obligatorio';
    }
    if (lower.includes('expected string') || lower.includes('expected type string')) {
        return 'Debe ingresar un texto válido';
    }
    if (lower.includes('expected number') || lower.includes('expected integer') || lower.includes('expected type number')) {
        return 'Debe ingresar un número válido';
    }
    if (lower.includes('expected boolean')) {
        return 'Debe ser verdadero o falso';
    }
    if (lower.includes('expected format: email') || lower.includes('format: email')) {
        return 'El formato del correo electrónico no es válido';
    }

    // Si ya es un mensaje en español o no coincide con patrones en inglés, conservarlo
    return msg;
}

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