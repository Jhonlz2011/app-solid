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
        errorMap?: Record<string, unknown>;
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

// Global context to track explicit submission attempts directly from `onSubmit` event traps natively
import { createContext } from 'solid-js';
export const FormSubmissionContext = createContext<() => boolean>(() => false);

/**
 * Check if field has validation errors
 */
export const hasFieldError = <T>(field: FieldLike<T>, forceVisible: boolean = false): boolean => {
    if (field.state.meta.errors.length === 0) return false;

    const hasSubmitError = field.state.meta.errorMap?.onSubmit !== undefined;

    // Best Practice UX: 
    // - Hide errors on completely untouched fields while the user is filling the form initially.
    // - Reveal ALL active errors instantly once the user attempts to submit the form once (tracked via forceVisible).
    // - Always show dedicated server-side errors mapped to onSubmit.
    return field.state.meta.isTouched || forceVisible || hasSubmitError;
};

/**
 * Get the first error message from a field
 */
export const getFieldError = <T>(field: FieldLike<T>): string => {
    return extractErrorMessage(field.state.meta.errors[0]);
};
