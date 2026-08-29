import { createForm } from '@tanstack/solid-form';
import { EntityFormSchema, type EntityFormData } from '@app/schema/frontend';

/**
 * We create a dummy form instance solely to infer the exact FormApi type.
 * This avoids manually writing out the 11-12 generic type arguments required by TanStack Form,
 * while maintaining 100% type safety and completely avoiding the use of `any`.
 */
const __dummyForm = createForm(() => ({
    defaultValues: {} as EntityFormData,
    validators: {
        onChange: EntityFormSchema,
        onSubmit: EntityFormSchema,
    },
}));

/** The fully-inferred, 100% type-safe form API for the Entity Form */
export type EntityFormApi = typeof __dummyForm;
