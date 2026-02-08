// ============================================================================
// FORM TYPES - Shared types for TanStack Form integration
// ============================================================================

/**
 * Minimal field state interface compatible with TanStack Form's FieldApi
 * This abstraction allows components to work without importing TanStack directly
 */
export interface FieldState<TValue = string> {
    value: TValue;
    meta: {
        errors: readonly unknown[];
        isTouched: boolean;
        isValidating: boolean;
    };
}

/**
 * Minimal field interface for atomic form components
 * Compatible with TanStack Form's field() return value
 */
export interface FieldLike<TValue = string> {
    name: string;
    state: FieldState<TValue>;
    handleChange: (value: TValue) => void;
    handleBlur: () => void;
}

/**
 * Extract error message from TanStack Form's complex error types
 * Handles: string, object with 'message', Valibot issues, and fallback
 */
export const extractErrorMessage = (err: unknown): string => {
    if (!err) return '';
    if (typeof err === 'string') return err;
    if (typeof err === 'object' && err !== null) {
        // Valibot/Zod style
        if ('message' in err) return (err as { message: string }).message;
        // Array of issues
        if (Array.isArray(err) && err[0]?.message) return err[0].message;
    }
    return String(err);
};

/**
 * Check if field has validation errors and has been touched
 */
export const hasFieldError = <T>(field: FieldLike<T>): boolean => {
    return field.state.meta.errors.length > 0 && field.state.meta.isTouched;
};

/**
 * Get the first error message from a field
 */
export const getFieldError = <T>(field: FieldLike<T>): string => {
    return extractErrorMessage(field.state.meta.errors[0]);
};
