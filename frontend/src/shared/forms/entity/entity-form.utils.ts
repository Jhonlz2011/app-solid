/**
 * Entity Form Utilities
 *
 * Centralized labels, default values, and reactive helper types
 * for the unified EntityForm component.
 */
import type { TaxIdTypeForm, PersonType, TaxRegimeType, EntityFormData } from '@app/schema/frontend';
import { TAX_ID_TYPES_FORM } from '@app/schema/frontend';
import {
    taxIdTypeFormLabels,
    personTypeLabels,
    taxRegimeTypeLabels,
    roleLabels,
} from '@shared/constants/entity-labels';

// =============================================================================
// Re-export Centralized Labels & Maps
// =============================================================================

export { personTypeLabels, taxRegimeTypeLabels, roleLabels };
export const taxIdTypeLabels = taxIdTypeFormLabels;

// =============================================================================
// Select Option Types
// =============================================================================

export interface SelectOption<T extends string> {
    value: T;
    label: string;
    disabled?: boolean;
}

export const taxIdTypeOptions: SelectOption<TaxIdTypeForm>[] = TAX_ID_TYPES_FORM.map(
    (value) => ({ value, label: taxIdTypeLabels[value] })
);

export const personTypeOptions: SelectOption<PersonType>[] = [
    { value: 'NATURAL', label: personTypeLabels.NATURAL },
    { value: 'JURIDICA', label: personTypeLabels.JURIDICA },
];

export const taxRegimeTypeOptions: SelectOption<TaxRegimeType>[] = [
    { value: 'RIMPE_NEGOCIO_POPULAR', label: taxRegimeTypeLabels.RIMPE_NEGOCIO_POPULAR },
    { value: 'RIMPE_EMPRENDEDOR', label: taxRegimeTypeLabels.RIMPE_EMPRENDEDOR },
    { value: 'GENERAL', label: taxRegimeTypeLabels.GENERAL },
];

// =============================================================================
// Default Values Factory
// =============================================================================

export const EMPTY_EMPLOYEE_DETAILS = {
    departmentId: undefined as number | null | undefined,
    jobTitleId: undefined as number | null | undefined,
    salaryBase: undefined as number | undefined,
    hireDate: '',
    costPerHour: undefined as number | undefined,
};

export const EMPTY_CARRIER_VEHICLE = {
    licensePlate: '',
    description: '',
    isActive: true,
};

export const EMPTY_CARRIER_DRIVER = {
    identificationNumber: '',
    fullName: '',
    phone: '',
    isActive: true,
};

export function createDefaultEntityFormValues(
    lockedRoles?: Partial<Record<'isClient' | 'isSupplier' | 'isEmployee' | 'isCarrier', boolean>>
): EntityFormData {
    return {
        taxId: '',
        taxIdType: 'RUC',
        personType: 'NATURAL',
        businessName: '',
        tradeName: '',
        emailBilling: '',
        phone: '',
        isClient: lockedRoles?.isClient ?? false,
        isSupplier: lockedRoles?.isSupplier ?? false,
        isEmployee: lockedRoles?.isEmployee ?? false,
        isCarrier: lockedRoles?.isCarrier ?? false,
        taxRegimeType: undefined,
        obligadoContabilidad: false,
        isRetentionAgent: false,
        isSpecialContributor: false,
        employeeDetails: undefined,
        contacts: [],
        addresses: [],
        vehicles: [],
        drivers: [],
    };
}

// =============================================================================
// Form Config & Rule Helpers
// =============================================================================

/** TaxIdType disabled keys for JURIDICA — CEDULA and PASAPORTE are invalid */
export function getTaxIdTypeDisabledKeys(personType: PersonType): TaxIdTypeForm[] {
    if (personType === 'JURIDICA') return ['CEDULA', 'PASAPORTE'];
    return [];
}

/** Get taxId max length and placeholder based on taxIdType */
export function getTaxIdConfig(taxIdType: TaxIdTypeForm): { maxLength: number | undefined; placeholder: string } {
    switch (taxIdType) {
        case 'CEDULA':
            return { maxLength: 10, placeholder: 'Cédula de 10 dígitos' };
        case 'RUC':
            return { maxLength: 13, placeholder: 'RUC de 13 dígitos' };
        case 'PASAPORTE':
            return { maxLength: 20, placeholder: 'Pasaporte alfanumérico' };
        case 'EXTERIOR':
            return { maxLength: undefined, placeholder: 'Número de identificación' };
    }
}

