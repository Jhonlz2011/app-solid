import { createForm } from '@tanstack/solid-form';
import { valibotValidator } from '@tanstack/valibot-form-adapter';
import { ProductFormSchema, type ProductFormData, type ProductVariantFormData } from '@app/schema/frontend';
import type { Accessor } from 'solid-js';

/**
 * We create a dummy form instance solely to infer the exact FormApi type.
 * This avoids manually writing out the generic type arguments required by TanStack Form,
 * while maintaining 100% type safety and completely avoiding the use of `any`.
 */
const __dummyForm = createForm(() => ({
    defaultValues: {} as ProductFormData,
    validatorAdapter: valibotValidator(),
    validators: {
        onChange: ProductFormSchema,
        onSubmit: ProductFormSchema,
    }
}));

/** Typed form instance for catalog (product/service) forms */
export type CatalogFormApi = typeof __dummyForm;

/** Base props shared by all catalog form sections */
export interface CatalogSectionProps {
    form: CatalogFormApi;
    hasAttemptedSubmit: Accessor<boolean>;
}

/** Section props that also receive pre-computed additional variants */
export interface CatalogSectionWithVariantsProps extends CatalogSectionProps {
    additionalVariants: Accessor<ProductVariantFormData[]>;
}
