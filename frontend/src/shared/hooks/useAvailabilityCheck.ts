import type { Accessor } from 'solid-js';

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
 * @deprecated Superseded by TanStack Form native async validation (`validators.onChangeAsync` with `asyncDebounceMs`).
 * See `@shared/ui/form/validators/availability.validators.ts`.
 * Native async validation maintains input focus by keeping state inside field.store and avoiding component-level re-renders.
 */
export function useAvailabilityCheck(_options: UseAvailabilityCheckOptions): UseAvailabilityCheckReturn {
    return {
        status: () => 'idle',
        isChecking: () => false,
        isAvailable: () => null,
        isCurrent: () => false,
        isValidFormat: () => true,
        debouncedValue: () => '',
    };
}
