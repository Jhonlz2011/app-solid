/**
 * BrandForm.tsx — Pure, decoupled form component for Brands
 * 
 * Uses TanStack Form v1 with native Standard Schema (Valibot v1).
 */
import { Component, createSignal } from 'solid-js';
import { createForm } from '@tanstack/solid-form';
import { BrandFormSchema, type BrandFormData } from '@app/schema/frontend';
import { FormSubmissionContext } from '@shared/ui/form/form.types';
import { handleFormApiErrors } from '@shared/utils/form.utils';
import type { BrandItem } from '@app/schema/dto';
import TextField from '@form/TextField';

export interface BrandFormProps {
    brand?: BrandItem | null;
    onSubmit: (data: BrandFormData) => Promise<void>;
    isSubmitting: boolean;
    formId: string;
    disabled?: boolean;
}

export const BrandForm: Component<BrandFormProps> = (props) => {
    const [hasAttemptedSubmit, setHasAttemptedSubmit] = createSignal(false);

    const initialValues = (): BrandFormData => ({
        name: props.brand?.name ?? '',
        website: props.brand?.website ?? '',
    });

    const form = createForm(() => ({
        defaultValues: initialValues(),
        validators: {
            onChange: BrandFormSchema,
            onSubmit: BrandFormSchema,
        },
        onSubmit: async ({ value }) => {
            try {
                await props.onSubmit(value);
            } catch (err) {
                handleFormApiErrors(form, err, 'Error al guardar la marca', props.formId);
            }
        },
    }));

    return (
        <FormSubmissionContext.Provider value={hasAttemptedSubmit}>
            <form
                id={props.formId}
                onSubmit={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setHasAttemptedSubmit(true);
                    form.handleSubmit();
                }}
                class="space-y-5 py-2"
            >
                <form.Field name="name">
                    {(field) => (
                        <TextField.Root field={field()} disabled={props.disabled || props.isSubmitting}>
                            <TextField.Label>Nombre *</TextField.Label>
                            <TextField.Input type="text" placeholder="Truper, Stanley, DeWalt..." />
                            <TextField.ErrorMessage />
                        </TextField.Root>
                    )}
                </form.Field>

                <form.Field name="website">
                    {(field) => (
                        <TextField.Root field={field()} disabled={props.disabled || props.isSubmitting}>
                            <TextField.Label>Sitio Web</TextField.Label>
                            <TextField.Input type="url" placeholder="https://www.marca.com" />
                            <TextField.ErrorMessage />
                        </TextField.Root>
                    )}
                </form.Field>
            </form>
        </FormSubmissionContext.Provider>
    );
};