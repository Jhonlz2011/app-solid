/**
 * Entity Form Utilities
 *
 * Centralized labels, default values, and reactive helper types
 * for the unified EntityForm component.
 */
import type { TaxIdTypeForm, PersonType, TaxRegimeType, EntityFormData } from '@app/schema/frontend';
import { TAX_ID_TYPES_FORM } from '@app/schema/frontend';

// =============================================================================
// Label Maps
// =============================================================================

export const taxIdTypeLabels: Record<TaxIdTypeForm, string> = {
    RUC: 'RUC',
    CEDULA: 'Cédula',
    PASAPORTE: 'Pasaporte',
    EXTERIOR: 'Exterior',
};

export const personTypeLabels: Record<PersonType, string> = {
    NATURAL: 'Persona Natural',
    JURIDICA: 'Persona Jurídica',
};

export const taxRegimeTypeLabels: Record<TaxRegimeType, string> = {
    RIMPE_NEGOCIO_POPULAR: 'RIMPE Popular',
    RIMPE_EMPRENDEDOR: 'RIMPE Emprendedor',
    GENERAL: 'Régimen General',
};

export const roleLabels = {
    isClient: 'Cliente',
    isSupplier: 'Proveedor',
    isEmployee: 'Empleado',
    isCarrier: 'Transportista',
} as const;

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
    department: '',
    jobTitle: '',
    salaryBase: undefined as number | undefined,
    hireDate: '',
    costPerHour: undefined as number | undefined,
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
    };
}

// =============================================================================
// Reactive Visibility Helpers (pure functions — called inside JSX or createMemo)
// =============================================================================

/** Tax section visible when: RUC, or any business role, or employee+supplier combo */
export function shouldShowTaxSection(values: EntityFormData): boolean {
    if (values.taxIdType === 'RUC') return true;
    if (values.isSupplier || values.isClient || values.isCarrier) return true;
    // Employee-only: hide tax section UNLESS also supplier (honorarios profesionales)
    if (values.isEmployee && values.isSupplier) return true;
    // Employee-only: no tax section
    if (values.isEmployee && !values.isSupplier && !values.isClient && !values.isCarrier) return false;
    return false;
}

/** Employee details visible when is_employee is checked */
export function shouldShowEmployeeDetails(values: EntityFormData): boolean {
    return values.isEmployee;
}

/** Contact sections visible when entity has any active role */
export function shouldShowContacts(values: EntityFormData): boolean {
    return values.isEmployee || values.isSupplier || values.isClient;
}

/** PersonType is locked (forced to NATURAL) when: CEDULA or isEmployee */
export function isPersonTypeLocked(values: EntityFormData): boolean {
    return values.taxIdType === 'CEDULA' || values.isEmployee;
}

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
        case 'EXTERIOR':
            return { maxLength: undefined, placeholder: 'Número de identificación' };
    }
}
