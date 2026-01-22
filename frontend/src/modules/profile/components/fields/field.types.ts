// Shared field types for TanStack Form atomic components
// These interfaces are compatible with TanStack Form's FieldApi without importing it directly

export interface FieldState {
    value: string;
    meta: {
        errors: readonly unknown[];
        isTouched: boolean;
    };
}

export interface FieldLike {
    name: string;
    state: FieldState;
    handleChange: (value: string) => void;
    handleBlur: () => void;
}

/**
 * Extract error message from TanStack Form's complex error types
 * Handles string errors, object errors with 'message' property, and fallback to String()
 */
export const extractErrorMessage = (err: unknown): string => {
    if (!err) return '';
    if (typeof err === 'string') return err;
    if (typeof err === 'object' && err !== null && 'message' in err) {
        return (err as { message: string }).message;
    }
    return String(err);
};
