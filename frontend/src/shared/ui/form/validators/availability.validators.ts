import { authClient } from '@shared/lib/auth-client';
import { authApi } from '@modules/auth/api/auth.api';
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
 * Validates username availability via Better-Auth client.
 * Respects currentValue exemption (e.g. profile editing) and format constraints.
 */
export const createUsernameAvailabilityValidator = (options?: AvailabilityValidatorOptions) => {
    return async ({ value, signal }: { value: unknown; signal: AbortSignal }): Promise<string | undefined> => {
        if (!resolveBoolean(options?.enabled)) return undefined;

        const val = typeof value === 'string' ? value.trim() : '';
        // Pre-flight check: minimum 3 chars, valid characters
        if (val.length < 3 || val.length > 30 || !/^[a-zA-Z0-9._-]+$/.test(val)) {
            return undefined; // Format errors are handled by synchronous schema
        }

        const current = resolveValue(options?.currentValue);
        if (current && val.toLowerCase() === current) {
            return undefined;
        }

        try {
            const res = await authClient.isUsernameAvailable(
                { username: val.toLowerCase() },
                { fetchOptions: { signal } }
            );
            if (signal.aborted) return undefined;
            if (res.error) return undefined;
            if (res.data && !res.data.available) {
                return options?.customMessage || 'El nombre de usuario ya está en uso';
            }
            return undefined;
        } catch {
            return undefined;
        }
    };
};

/**
 * Validates email availability via tenant check endpoint.
 */
export const createEmailAvailabilityValidator = (options?: AvailabilityValidatorOptions) => {
    return async ({ value, signal }: { value: unknown; signal: AbortSignal }): Promise<string | undefined> => {
        if (!resolveBoolean(options?.enabled)) return undefined;

        const val = typeof value === 'string' ? value.trim() : '';
        if (!val || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val)) {
            return undefined;
        }

        const current = resolveValue(options?.currentValue);
        if (current && val.toLowerCase() === current) {
            return undefined;
        }

        try {
            const res = await authApi.checkEmail(val.toLowerCase());
            if (signal.aborted) return undefined;
            if (!res.available) {
                return options?.customMessage || 'El correo electrónico ya está registrado';
            }
            return undefined;
        } catch {
            return undefined;
        }
    };
};

/**
 * Validates subdomain (slug) availability via tenant check endpoint.
 */
export const createSlugAvailabilityValidator = (options?: AvailabilityValidatorOptions) => {
    return async ({ value, signal }: { value: unknown; signal: AbortSignal }): Promise<string | undefined> => {
        if (!resolveBoolean(options?.enabled)) return undefined;

        const val = typeof value === 'string' ? value.trim() : '';
        if (val.length < 3 || val.length > 50 || !/^[a-z0-9-]+$/.test(val)) {
            return undefined;
        }

        const current = resolveValue(options?.currentValue);
        if (current && val.toLowerCase() === current) {
            return undefined;
        }

        try {
            const res = await authApi.checkSlug(val.toLowerCase());
            if (signal.aborted) return undefined;
            if (!res.available) {
                return options?.customMessage || 'El subdominio ya está en uso';
            }
            return undefined;
        } catch {
            return undefined;
        }
    };
};

/**
 * Validates RUC (13 numeric digits) availability via tenant check endpoint.
 */
export const createRucAvailabilityValidator = (options?: AvailabilityValidatorOptions) => {
    return async ({ value, signal }: { value: unknown; signal: AbortSignal }): Promise<string | undefined> => {
        if (!resolveBoolean(options?.enabled)) return undefined;

        const val = typeof value === 'string' ? value.trim() : '';
        if (!/^\d{13}$/.test(val)) {
            return undefined;
        }

        const current = resolveValue(options?.currentValue);
        if (current && val.toLowerCase() === current) {
            return undefined;
        }

        try {
            const res = await authApi.checkRuc(val);
            if (signal.aborted) return undefined;
            if (!res.available) {
                return options?.customMessage || 'El RUC ya está registrado';
            }
            return undefined;
        } catch {
            return undefined;
        }
    };
};
