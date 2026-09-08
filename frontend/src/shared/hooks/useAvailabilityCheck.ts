import { createSignal, createEffect, onCleanup, createMemo, type Accessor } from 'solid-js';
import { createQuery } from '@tanstack/solid-query';
import { authClient } from '@shared/lib/auth-client';
import { authApi } from '@modules/auth/api/auth.api';

export type AvailabilityType = 'username' | 'email' | 'slug' | 'ruc';

export type AvailabilityStatus = 'idle' | 'checking' | 'current' | 'available' | 'taken' | 'invalid';

export interface UseAvailabilityCheckOptions {
    type: AvailabilityType;
    value: Accessor<string>;
    currentValue?: Accessor<string | undefined | null>;
    debounceMs?: number;
    enabled?: Accessor<boolean>;
}

export interface UseAvailabilityCheckReturn {
    status: Accessor<AvailabilityStatus>;
    isChecking: Accessor<boolean>;
    isAvailable: Accessor<boolean | null>;
    isCurrent: Accessor<boolean>;
    isValidFormat: Accessor<boolean>;
    debouncedValue: Accessor<string>;
}

/**
 * Universal reactive hook for debounced real-time availability checks across the entire app.
 * Integrates directly with Better-Auth native endpoints (username) and tenant check routes (email, slug, ruc).
 */
export function useAvailabilityCheck(options: UseAvailabilityCheckOptions): UseAvailabilityCheckReturn {
    const delay = options.debounceMs ?? 350;

    // 1. Reactive debounce signal with automatic timer cleanup
    const [debouncedValue, setDebouncedValue] = createSignal(options.value().trim());

    createEffect(() => {
        const val = options.value().trim();
        const timer = setTimeout(() => {
            setDebouncedValue(val);
        }, delay);

        onCleanup(() => clearTimeout(timer));
    });

    // 2. Format pre-flight validation
    const isValidFormat = createMemo(() => {
        const val = debouncedValue();
        if (!val) return false;

        switch (options.type) {
            case 'username':
                return val.length >= 3 && val.length <= 30 && /^[a-zA-Z0-9._-]+$/.test(val);
            case 'email':
                return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val);
            case 'slug':
                return val.length >= 3 && val.length <= 50 && /^[a-z0-9-]+$/.test(val);
            case 'ruc':
                return /^\d{13}$/.test(val);
            default:
                return false;
        }
    });

    // 3. Current user / company value exemption
    const isCurrent = createMemo(() => {
        const current = options.currentValue?.()?.trim().toLowerCase();
        const input = debouncedValue().toLowerCase();
        return Boolean(current && input && current === input);
    });

    // 4. TanStack Query caching & automated request lifecycle
    const query = createQuery(() => {
        const val = debouncedValue().toLowerCase();
        const isExempt = isCurrent();
        const isExplicitlyEnabled = options.enabled ? options.enabled() : true;

        return {
            queryKey: ['availability-check', options.type, val],
            queryFn: async () => {
                if (options.type === 'username') {
                    const res = await authClient.isUsernameAvailable({ username: val });
                    if (res.error) throw new Error(res.error.message || 'Error al verificar usuario');
                    return { available: res.data?.available ?? false };
                }

                if (options.type === 'email') {
                    const res = await authApi.checkEmail(val);
                    return { available: res.available };
                }

                if (options.type === 'slug') {
                    const res = await authApi.checkSlug(val);
                    return { available: res.available };
                }

                if (options.type === 'ruc') {
                    const res = await authApi.checkRuc(val);
                    return { available: res.available };
                }

                return { available: false };
            },
            enabled: isExplicitlyEnabled && isValidFormat() && !isExempt,
            staleTime: 30_000,
            gcTime: 60_000,
            retry: false,
        };
    });

    // 5. Unified high-level status memo
    const status = createMemo<AvailabilityStatus>(() => {
        const raw = options.value().trim();
        if (!raw) return 'idle';
        if (!isValidFormat()) return 'invalid';
        if (isCurrent()) return 'current';
        if (query.isFetching) return 'checking';
        if (query.data?.available === true) return 'available';
        if (query.data?.available === false) return 'taken';
        return 'idle';
    });

    const isAvailable = createMemo<boolean | null>(() => {
        if (!isValidFormat()) return null;
        if (isCurrent()) return true;
        if (query.isFetching) return null;
        return query.data?.available ?? null;
    });

    return {
        status,
        isChecking: () => query.isFetching,
        isAvailable,
        isCurrent,
        isValidFormat,
        debouncedValue,
    };
}
