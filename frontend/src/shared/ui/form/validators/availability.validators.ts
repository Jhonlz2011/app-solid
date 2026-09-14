import { safeParse } from 'valibot';
import { authClient } from '@shared/lib/auth-client';
import { authApi } from '@modules/auth/api/auth.api';
import { ApiError } from '@shared/utils/api-errors';
import { API_ERROR_CODES, ERROR_MESSAGES_ES } from '@app/schema/errors';
import {
    UsernameFormatSchema,
    EmailFormatSchema,
    SlugFormatSchema,
    RucFormatSchema,
} from '@app/schema/frontend';
import type { Accessor } from 'solid-js';

export interface AvailabilityValidatorOptions {
    currentValue?: string | Accessor<string | undefined | null>;
    customMessage?: string;
    enabled?: boolean | Accessor<boolean>;
}

/** Helper to resolve currentValue which might be a string or Accessor */
const resolveValue = (v?: string | Accessor<string | undefined | null>): string | undefined => {
    if (!v) return undefined;
    const raw = typeof v === 'function' ? v() : v;
    return raw?.trim().toLowerCase();
};

const resolveBoolean = (b?: boolean | Accessor<boolean>): boolean => {
    if (b === undefined) return true;
    return typeof b === 'function' ? b() : b;
};

/**
 * Handles API errors strictly and type-safely.
 * - Silent return for abort signals (user typed newer input).
 * - Explicit error message for 429 rate limit or server errors.
 */
const handleAvailabilityError = (err: unknown, signal: AbortSignal): string | undefined => {
    if (signal.aborted || (err instanceof DOMException && err.name === 'AbortError')) {
        return undefined;
    }

    if (err instanceof ApiError) {
        if (err.code === API_ERROR_CODES.TOO_MANY_REQUESTS) {
            return err.message || ERROR_MESSAGES_ES.TOO_MANY_REQUESTS;
        }
        return err.message;
    }

    return undefined;
};

/**
 * Validates username availability via Better-Auth client.
 * Uses Valibot safeParse pre-flight check to prevent unnecessary network calls.
 * Respects currentValue exemption (e.g. profile editing).
 */
export const createUsernameAvailabilityValidator = (options?: AvailabilityValidatorOptions) => {
    return async ({ value, signal }: { value: unknown; signal: AbortSignal }): Promise<string | undefined> => {
        if (!resolveBoolean(options?.enabled)) return undefined;

        const val = typeof value === 'string' ? value.trim().toLowerCase() : '';

        // 1. Synchronous Valibot validation check — prevents unnecessary network calls!
        const parsed = safeParse(UsernameFormatSchema, val);
        if (!parsed.success) {
            return undefined; // Format errors are handled by synchronous schema on onChange
        }

        // 2. Exemption check for unchanged current value
        const current = resolveValue(options?.currentValue);
        if (current && val === current) {
            return undefined;
        }

        // 3. Network availability check
        try {
            const res = await authClient.isUsernameAvailable(
                { username: val },
                { signal }
            );
            if (signal.aborted) return undefined;
            if (res.error) {
                if (res.error.status === 429) {
                    return ERROR_MESSAGES_ES.TOO_MANY_REQUESTS;
                }
                return undefined;
            }
            if (res.data && !res.data.available) {
                return options?.customMessage || 'El nombre de usuario ya está en uso';
            }
            return undefined;
        } catch (err: unknown) {
            return handleAvailabilityError(err, signal);
        }
    };
};

/**
 * Validates email availability via tenant check endpoint.
 * Uses Valibot safeParse pre-flight check to prevent unnecessary network calls.
 */
export const createEmailAvailabilityValidator = (options?: AvailabilityValidatorOptions) => {
    return async ({ value, signal }: { value: unknown; signal: AbortSignal }): Promise<string | undefined> => {
        if (!resolveBoolean(options?.enabled)) return undefined;

        const val = typeof value === 'string' ? value.trim().toLowerCase() : '';

        // 1. Synchronous Valibot validation check — prevents unnecessary network calls!
        const parsed = safeParse(EmailFormatSchema, val);
        if (!parsed.success) {
            return undefined;
        }

        // 2. Exemption check for unchanged current value
        const current = resolveValue(options?.currentValue);
        if (current && val === current) {
            return undefined;
        }

        // 3. Network availability check
        try {
            const res = await authApi.checkEmail(val, signal);
            if (signal.aborted) return undefined;
            if (!res.available) {
                return options?.customMessage || 'El correo electrónico ya está registrado';
            }
            return undefined;
        } catch (err) {
            return handleAvailabilityError(err, signal);
        }
    };
};

/**
 * Validates subdomain (slug) availability via tenant check endpoint.
 * Uses Valibot safeParse pre-flight check to prevent unnecessary network calls.
 */
export const createSlugAvailabilityValidator = (options?: AvailabilityValidatorOptions) => {
    return async ({ value, signal }: { value: unknown; signal: AbortSignal }): Promise<string | undefined> => {
        if (!resolveBoolean(options?.enabled)) return undefined;

        const val = typeof value === 'string' ? value.trim().toLowerCase() : '';

        // 1. Synchronous Valibot validation check — prevents unnecessary network calls!
        const parsed = safeParse(SlugFormatSchema, val);
        if (!parsed.success) {
            return undefined;
        }

        // 2. Exemption check for unchanged current value
        const current = resolveValue(options?.currentValue);
        if (current && val === current) {
            return undefined;
        }

        // 3. Network availability check
        try {
            const res = await authApi.checkSlug(val, signal);
            if (signal.aborted) return undefined;
            if (!res.available) {
                return options?.customMessage || 'El subdominio ya está en uso';
            }
            return undefined;
        } catch (err) {
            return handleAvailabilityError(err, signal);
        }
    };
};

/**
 * Validates RUC (13 numeric digits) availability via tenant check endpoint.
 * Uses Valibot safeParse pre-flight check to prevent unnecessary network calls.
 */
export const createRucAvailabilityValidator = (options?: AvailabilityValidatorOptions) => {
    return async ({ value, signal }: { value: unknown; signal: AbortSignal }): Promise<string | undefined> => {
        if (!resolveBoolean(options?.enabled)) return undefined;

        const val = typeof value === 'string' ? value.trim() : '';

        // 1. Synchronous Valibot validation check — prevents unnecessary network calls!
        const parsed = safeParse(RucFormatSchema, val);
        if (!parsed.success) {
            return undefined;
        }

        // 2. Exemption check for unchanged current value
        const current = resolveValue(options?.currentValue);
        if (current && val.toLowerCase() === current) {
            return undefined;
        }

        // 3. Network availability check
        try {
            const res = await authApi.checkRuc(val, signal);
            if (signal.aborted) return undefined;
            if (!res.available) {
                return options?.customMessage || 'El RUC ya está registrado';
            }
            return undefined;
        } catch (err) {
            return handleAvailabilityError(err, signal);
        }
    };
};
