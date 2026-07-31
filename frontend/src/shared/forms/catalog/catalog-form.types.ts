import type { FormApi } from '@tanstack/solid-form';
import type { ProductFormData, ProductVariantFormData } from '@app/schema/frontend';
import type { ValibotValidator } from '@tanstack/valibot-form-adapter';
import type { Accessor } from 'solid-js';

/** Typed form instance for catalog (product/service) forms */
export type CatalogForm = FormApi<ProductFormData, ValibotValidator>;

/** Base props shared by all catalog form sections */
export interface CatalogSectionProps {
    form: CatalogForm;
    hasAttemptedSubmit: Accessor<boolean>;
}

/** Section props that also receive pre-computed additional variants */
export interface CatalogSectionWithVariantsProps extends CatalogSectionProps {
    additionalVariants: Accessor<ProductVariantFormData[]>;
}
