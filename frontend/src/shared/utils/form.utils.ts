/**
 * form.utils.ts — Universal form helper utilities for TanStack Form (Standard Schema compatible)
 */
import { ApiError, parseApiError, isNetworkError } from './api-errors';
import { isOffline, showOfflineSavedToast } from './offline-submit';
import { toast } from 'solid-sonner';

/**
 * Automatically focuses and scrolls to the first invalid field in the form.
 * Useful after submission validation failures or when backend errors are mapped.
 *
 * @param containerId - Optional HTML ID of the form container
 */
export function focusFirstInvalidField(containerId?: string): void {
    setTimeout(() => {
        const root = containerId ? document.getElementById(containerId) : document;
        if (!root) return;

        const firstInvalid = root.querySelector<HTMLElement>(
            '[aria-invalid="true"], [data-invalid="true"], .is-invalid input, input:invalid, select:invalid, textarea:invalid'
        );

        if (firstInvalid) {
            firstInvalid.focus();
            firstInvalid.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
    }, 60);
}

/**
 * Maps backend validation errors (e.g. 422 Unprocessable Entity with field errors)
 * directly to TanStack Form field error metadata (`errorMap.onSubmit`),
 * providing contextual inline feedback directly under the offending fields.
 * If no specific field errors are present, falls back to a global toast.
 *
 * @param form - TanStack Form API instance
 * @param error - Caught error from submit handler
 * @param fallbackMessage - Fallback toast message if no specific error message is resolved
 * @param formId - Optional HTML ID of the form container for auto-focus
 */
export function handleFormApiErrors(
    form: any,
    error: unknown,
    fallbackMessage = 'Error al guardar los datos',
    formId?: string
): void {
    if (!error) return;

    // 1. ApiError with field-level errors
    if (error instanceof ApiError && error.errors && error.errors.length > 0) {
        let mappedAny = false;
        for (const fieldErr of error.errors) {
            try {
                form.setFieldMeta(fieldErr.field, (prev: any) => ({
                    ...prev,
                    errorMap: {
                        ...prev?.errorMap,
                        onSubmit: fieldErr.message,
                    },
                }));
                mappedAny = true;
            } catch {
                // Field might not exist in this form
            }
        }
        if (mappedAny) {
            toast.error('Revisa los campos señalados en el formulario');
            focusFirstInvalidField(formId);
            return;
        }
    }

    // 2. Generic parsed API error with errors array
    const parsed = parseApiError(error);
    if (parsed.errors && parsed.errors.length > 0) {
        let mappedAny = false;
        for (const fieldErr of parsed.errors) {
            try {
                form.setFieldMeta(fieldErr.field, (prev: any) => ({
                    ...prev,
                    errorMap: {
                        ...prev?.errorMap,
                        onSubmit: fieldErr.message,
                    },
                }));
                mappedAny = true;
            } catch {
                // Field might not exist in this form
            }
        }
        if (mappedAny) {
            toast.error('Revisa los campos señalados en el formulario');
            focusFirstInvalidField(formId);
            return;
        }
    }

    // 3. Fallback to toast
    toast.error(parsed.message || fallbackMessage);
}

export interface FormMutationOptions<TData = any, TVariables = any> {
    mutation: {
        mutate: (variables: TVariables, options?: any) => void;
    };
    variables: TVariables;
    successMessage: string;
    onSuccess?: (data: TData) => void;
    onComplete?: () => void;
}

/**
 * Standardized orchestrator for executing TanStack Query mutations within Sheet/Modal form flows.
 * Handles:
 *   - Offline detection & local sync queuing
 *   - Network error tolerance
 *   - Toast notifications
 *   - Clean Promise resolution/rejection for TanStack Form onSubmit coordination
 *
 * @param options - Configuration for mutation execution
 */
export function executeFormMutation<TData = any, TVariables = any>(
    options: FormMutationOptions<TData, TVariables>
): Promise<TData> {
    if (isOffline()) {
        options.mutation.mutate(options.variables);
        showOfflineSavedToast();
        options.onComplete?.();
        return Promise.resolve(undefined as unknown as TData);
    }

    return new Promise<TData>((resolve, reject) => {
        options.mutation.mutate(options.variables, {
            onSuccess: (data: TData) => {
                toast.success(options.successMessage);
                options.onSuccess?.(data);
                options.onComplete?.();
                resolve(data);
            },
            onError: (err: any) => {
                if (isNetworkError(err)) {
                    showOfflineSavedToast();
                    options.onComplete?.();
                    resolve(undefined as unknown as TData);
                    return;
                }
                reject(err);
            },
        });
    });
}
