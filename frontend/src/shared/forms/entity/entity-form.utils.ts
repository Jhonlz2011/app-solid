/**
 * Entity Form Utilities
 *
 * Centralized labels, default values, and reactive helper types
 * for the unified EntityForm component.
 */
import type { EntityFormData } from '@app/schema/frontend';
import type { TaxIdTypeForm, PersonType, TaxRegimeType, SalaryType, ContractType, BankAccountType } from '@app/schema/enums';
import { TAX_ID_TYPES_FORM, CONTRACT_TYPES, BANK_ACCOUNT_TYPES, DEFAULT_SBU, MONTHLY_WORK_HOURS } from '@app/schema/enums';
import type { EntityDetailType } from '@app/schema/dto';
import {
    taxIdTypeFormLabels,
    personTypeLabels,
    taxRegimeTypeLabels,
    contractTypeLabels,
    bankAccountTypeLabels,
    roleLabels,
} from '@shared/constants/entity-labels';

// =============================================================================
// Re-export Centralized Labels & Maps
// =============================================================================

export { personTypeLabels, taxRegimeTypeLabels, contractTypeLabels, bankAccountTypeLabels, roleLabels };
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

export const contractTypeOptions: SelectOption<ContractType>[] = CONTRACT_TYPES.map(
    (value) => ({ value, label: contractTypeLabels[value] })
);

export const bankAccountTypeOptions: SelectOption<BankAccountType>[] = BANK_ACCOUNT_TYPES.map(
    (value) => ({ value, label: bankAccountTypeLabels[value] })
);

// =============================================================================
// Default Values Factory
// =============================================================================

export const EMPTY_EMPLOYEE_DETAILS = {
    departmentId: undefined as number | null | undefined,
    jobTitleId: undefined as number | null | undefined,
    reportsTo: undefined as string | null | undefined,
    hireDate: '',
    terminationDate: undefined as string | null | undefined,
    contractType: 'INDEFINIDO' as ContractType | undefined,
    salaryType: 'SBU' as SalaryType | undefined,
    salaryBase: DEFAULT_SBU,
    costPerHour: Number((DEFAULT_SBU / MONTHLY_WORK_HOURS).toFixed(2)),
    accumulateThirteenth: true,
    accumulateFourteenth: true,
    accumulateReserveFunds: true,
    iessCode: '',
    dependentsCount: 0,
    bankName: '',
    bankAccountType: undefined as BankAccountType | undefined,
    bankAccountNumber: '',
    notes: '',
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

/**
 * Maps an EntityDetailType DTO from the server or local ERP lookup to EntityFormData.
 */
export function mapEntityDetailToFormData(
    e: EntityDetailType,
    fallbackLockedRoles?: Partial<Record<'isClient' | 'isSupplier' | 'isEmployee' | 'isCarrier', boolean>>
): EntityFormData {
    return {
        taxId: e.tax_id,
        taxIdType: (e.tax_id_type || 'RUC') as TaxIdTypeForm,
        personType: (e.person_type || 'NATURAL') as PersonType,
        businessName: e.business_name || '',
        tradeName: e.trade_name ?? '',
        emailBilling: e.email_billing ?? '',
        phone: e.phone ?? '',
        isClient: e.is_client ?? fallbackLockedRoles?.isClient ?? false,
        isSupplier: e.is_supplier ?? fallbackLockedRoles?.isSupplier ?? false,
        isEmployee: e.is_employee ?? fallbackLockedRoles?.isEmployee ?? false,
        isCarrier: e.is_carrier ?? fallbackLockedRoles?.isCarrier ?? false,
        taxRegimeType: (e.tax_regime_type ?? undefined) as TaxRegimeType | undefined,
        obligadoContabilidad: !!e.obligado_contabilidad,
        isRetentionAgent: !!e.is_retention_agent,
        isSpecialContributor: !!e.is_special_contributor,
        employeeDetails: e.employeeDetails ? {
            departmentId: e.employeeDetails.department_id ?? undefined,
            jobTitleId: e.employeeDetails.job_title_id ?? undefined,
            reportsTo: e.employeeDetails.reports_to ?? undefined,
            hireDate: e.employeeDetails.hire_date ?? '',
            terminationDate: e.employeeDetails.termination_date ?? undefined,
            contractType: (e.employeeDetails.contract_type ?? 'INDEFINIDO') as ContractType,
            salaryType: (e.employeeDetails.salary_type ?? 'SBU') as SalaryType,
            salaryBase: e.employeeDetails.salary_base ? Number(e.employeeDetails.salary_base) : DEFAULT_SBU,
            costPerHour: e.employeeDetails.cost_per_hour ? Number(e.employeeDetails.cost_per_hour) : Number((DEFAULT_SBU / MONTHLY_WORK_HOURS).toFixed(2)),
            accumulateThirteenth: e.employeeDetails.accumulate_thirteenth ?? true,
            accumulateFourteenth: e.employeeDetails.accumulate_fourteenth ?? true,
            accumulateReserveFunds: e.employeeDetails.accumulate_reserve_funds ?? true,
            iessCode: e.employeeDetails.iess_code ?? '',
            dependentsCount: e.employeeDetails.dependents_count ?? 0,
            bankName: e.employeeDetails.bank_name ?? '',
            bankAccountType: (e.employeeDetails.bank_account_type ?? undefined) as BankAccountType | undefined,
            bankAccountNumber: e.employeeDetails.bank_account_number ?? '',
            notes: e.employeeDetails.notes ?? '',
        } : undefined,
        contacts: e.contacts?.map((c) => ({
            name: c.name,
            position: c.position ?? '',
            email: c.email ?? '',
            phone: c.phone ?? '',
            isPrimary: c.is_primary ?? false,
        })) ?? [],
        addresses: e.addresses?.map((a) => ({
            addressLine: a.address_line ?? '',
            city: a.city ?? '',
            country: a.country ?? 'Ecuador',
            countryCode: a.country_code ?? 'EC',
            postalCode: a.postal_code ?? '',
            isMain: a.is_main ?? false,
        })) ?? [],
        vehicles: e.vehicles?.map((v) => ({
            licensePlate: v.license_plate ?? '',
            description: v.description ?? '',
            isActive: v.is_active ?? true,
        })) ?? [],
        drivers: e.drivers?.map((d) => ({
            identificationNumber: d.identification_number ?? '',
            fullName: d.full_name ?? '',
            phone: d.phone ?? '',
            isActive: d.is_active ?? true,
        })) ?? [],
    };
}

// =============================================================================
// Form Config & Rule Helpers
// =============================================================================

/** Checks if the identification type is strictly a personal document (CEDULA or PASAPORTE) */
export function isPersonalTaxId(taxIdType: TaxIdTypeForm): boolean {
    return taxIdType === 'CEDULA' || taxIdType === 'PASAPORTE';
}

/** TaxIdEnum disabled keys for JURIDICA — CEDULA and PASAPORTE are invalid */
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


