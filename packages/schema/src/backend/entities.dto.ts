import { Type, type Static } from '@sinclair/typebox';
import { CursorMetaSchema, type CursorFilters } from './common.dto';
import type { PersonType, TaxIdType } from '../enums';

// ============================================================================
// ENTITY ENUMS & SUB-SCHEMAS (TypeBox for Elysia routes & Eden Treaty)
// ============================================================================
export interface EntityFilters extends CursorFilters {
    personType?: PersonType[];
    taxIdType?: TaxIdType[];
    isActive?: string[];
    businessName?: string[];
    isCarrier?: boolean;
}

export const TaxIdTypeSchema = Type.Union([
    Type.Literal('RUC'),
    Type.Literal('CEDULA'),
    Type.Literal('PASAPORTE'),
    Type.Literal('CONSUMIDOR_FINAL'),
    Type.Literal('EXTERIOR'),
]);

export const TaxIdTypeFormSchema = Type.Union([
    Type.Literal('RUC'),
    Type.Literal('CEDULA'),
    Type.Literal('PASAPORTE'),
    Type.Literal('EXTERIOR'),
]);

export const PersonTypeSchema = Type.Union([
    Type.Literal('NATURAL'),
    Type.Literal('JURIDICA'),
]);

export const TaxRegimeTypeSchema = Type.Union([
    Type.Literal('RIMPE_NEGOCIO_POPULAR'),
    Type.Literal('RIMPE_EMPRENDEDOR'),
    Type.Literal('GENERAL'),
]);

export const SalaryTypeSchema = Type.Union([
    Type.Literal('SBU'),
    Type.Literal('CUSTOM'),
]);

export const ContractTypeSchema = Type.Union([
    Type.Literal('INDEFINIDO'),
    Type.Literal('EVENTUAL'),
    Type.Literal('PLAZO_FIJO'),
    Type.Literal('OBRA_CIERTA'),
    Type.Literal('PASANTIA'),
    Type.Literal('SERVICIOS_PROFESIONALES'),
]);

export const BankAccountTypeSchema = Type.Union([
    Type.Literal('AHORROS'),
    Type.Literal('CORRIENTE'),
]);

export const ContactBodySchema = Type.Object({
    name: Type.String(),
    position: Type.String(),
    email: Type.Union([Type.String({ format: 'email' }), Type.Literal('')]),
    phone: Type.String(),
    isPrimary: Type.Boolean()
});

export const AddressBodySchema = Type.Object({
    addressLine: Type.String(),
    city: Type.String(),
    country: Type.String(),
    countryCode: Type.String(),
    postalCode: Type.String(),
    isMain: Type.Boolean()
});

export const EmployeeDetailsBodySchema = Type.Object({
    departmentId: Type.Optional(Type.Union([Type.Number(), Type.Null()])),
    jobTitleId: Type.Optional(Type.Union([Type.Number(), Type.Null()])),
    reportsTo: Type.Optional(Type.Union([Type.String(), Type.Null()])),
    hireDate: Type.Optional(Type.Union([Type.String(), Type.Null()])),
    terminationDate: Type.Optional(Type.Union([Type.String(), Type.Null()])),
    contractType: Type.Optional(ContractTypeSchema),
    salaryType: Type.Optional(SalaryTypeSchema),
    salaryBase: Type.Optional(Type.Union([Type.Number(), Type.Null()])),
    costPerHour: Type.Optional(Type.Union([Type.Number(), Type.Null()])),
    accumulateThirteenth: Type.Optional(Type.Boolean()),
    accumulateFourteenth: Type.Optional(Type.Boolean()),
    accumulateReserveFunds: Type.Optional(Type.Boolean()),
    iessCode: Type.Optional(Type.Union([Type.String(), Type.Null()])),
    dependentsCount: Type.Optional(Type.Union([Type.Number(), Type.Null()])),
    bankName: Type.Optional(Type.Union([Type.String(), Type.Null()])),
    bankAccountType: Type.Optional(Type.Union([BankAccountTypeSchema, Type.Null()])),
    bankAccountNumber: Type.Optional(Type.Union([Type.String(), Type.Null()])),
    notes: Type.Optional(Type.Union([Type.String(), Type.Null()])),
});

// Departments & Job Titles DTOs (TypeBox)
export const DepartmentBodySchema = Type.Object({
    name: Type.String({ minLength: 1 }),
    code: Type.Optional(Type.String()),
});

export const JobTitleBodySchema = Type.Object({
    name: Type.String({ minLength: 1 }),
    departmentId: Type.Optional(Type.Union([Type.Number(), Type.Null()])),
});

export const DepartmentResponseSchema = Type.Object({
    id: Type.Number(),
    name: Type.String(),
    code: Type.Optional(Type.Union([Type.String(), Type.Null()])),
    is_active: Type.Boolean(),
});

export const JobTitleResponseSchema = Type.Object({
    id: Type.Number(),
    name: Type.String(),
    department_id: Type.Optional(Type.Union([Type.Number(), Type.Null()])),
    is_active: Type.Boolean(),
});

export const CarrierVehicleBodySchema = Type.Object({
    licensePlate: Type.String(),
    description: Type.Optional(Type.String()),
    isActive: Type.Boolean(),
});

export const CarrierVehicleUpdateSchema = Type.Partial(CarrierVehicleBodySchema);

export const CarrierDriverBodySchema = Type.Object({
    identificationNumber: Type.String(),
    fullName: Type.String(),
    phone: Type.Optional(Type.String()),
    isActive: Type.Boolean(),
});

// Main Entity Form Schema (TypeBox) - Aligned strictly with frontend Valibot schema
export const EntityBodySchema = Type.Object({
    taxId: Type.String(),
    taxIdType: TaxIdTypeFormSchema,
    personType: PersonTypeSchema,
    businessName: Type.String(),
    tradeName: Type.String(),
    emailBilling: Type.Union([Type.String({ format: 'email' }), Type.Literal('')]),
    phone: Type.String(),
    isClient: Type.Boolean(),
    isSupplier: Type.Boolean(),
    isEmployee: Type.Boolean(),
    isCarrier: Type.Boolean(),
    taxRegimeType: Type.Optional(TaxRegimeTypeSchema),
    obligadoContabilidad: Type.Boolean(),
    isRetentionAgent: Type.Boolean(),
    isSpecialContributor: Type.Boolean(),
    employeeDetails: Type.Optional(EmployeeDetailsBodySchema),
    contacts: Type.Array(ContactBodySchema),
    addresses: Type.Array(AddressBodySchema),
    vehicles: Type.Array(CarrierVehicleBodySchema),
    drivers: Type.Array(CarrierDriverBodySchema),
});

export const EntityUpdateBodySchema = Type.Partial(Type.Omit(EntityBodySchema, ['taxId', 'taxIdType']));

export const EntityTypeSchema = Type.Union([
    Type.Literal('client'),
    Type.Literal('supplier'),
    Type.Literal('employee'),
    Type.Literal('carrier'),
]);

export const EntityPickerQuerySchema = Type.Object({
    search: Type.Optional(Type.String()),
    limit: Type.Optional(Type.Number()),
    type: Type.Optional(EntityTypeSchema),
    isClient: Type.Optional(Type.Boolean()),
    isSupplier: Type.Optional(Type.Boolean()),
    isEmployee: Type.Optional(Type.Boolean()),
    isCarrier: Type.Optional(Type.Boolean()),
    isActive: Type.Optional(Type.Boolean()),
});

export const EntityListQuerySchema = Type.Object({
    cursor: Type.Optional(Type.String()),
    direction: Type.Optional(Type.String()),
    search: Type.Optional(Type.String()),
    limit: Type.Optional(Type.Number()),
    sortBy: Type.Optional(Type.String()),
    sortOrder: Type.Optional(Type.String()),
    page: Type.Optional(Type.Number()),
    personType: Type.Optional(Type.String()),
    taxIdType: Type.Optional(Type.String()),
    isActive: Type.Optional(Type.String()),
    businessName: Type.Optional(Type.String()),
    isCarrier: Type.Optional(Type.Boolean()),
});

export const EntityFacetsQuerySchema = Type.Object({
    search: Type.Optional(Type.String()),
    personType: Type.Optional(Type.String()),
    taxIdType: Type.Optional(Type.String()),
    isActive: Type.Optional(Type.String()),
    businessName: Type.Optional(Type.String()),
});

export const EntityListItemResponseSchema = Type.Object({
    id: Type.String(),
    company_id: Type.Number(),
    tax_id: Type.String(),
    tax_id_type: Type.String(),
    person_type: Type.String(),
    business_name: Type.String(),
    trade_name: Type.Optional(Type.Union([Type.String(), Type.Null()])),
    email_billing: Type.Optional(Type.Union([Type.String(), Type.Null()])),
    phone: Type.Optional(Type.Union([Type.String(), Type.Null()])),
    is_client: Type.Optional(Type.Union([Type.Boolean(), Type.Null()])),
    is_supplier: Type.Optional(Type.Union([Type.Boolean(), Type.Null()])),
    is_employee: Type.Optional(Type.Union([Type.Boolean(), Type.Null()])),
    is_carrier: Type.Optional(Type.Union([Type.Boolean(), Type.Null()])),
    is_system: Type.Optional(Type.Union([Type.Boolean(), Type.Null()])),
    tax_regime_type: Type.Optional(Type.Union([Type.String(), Type.Null()])),
    is_retention_agent: Type.Optional(Type.Union([Type.Boolean(), Type.Null()])),
    is_special_contributor: Type.Optional(Type.Union([Type.Boolean(), Type.Null()])),
    obligado_contabilidad: Type.Boolean(),
    default_price_list_id: Type.Optional(Type.Union([Type.Number(), Type.Null()])),
    is_active: Type.Boolean(),
    created_at: Type.Union([Type.Date(), Type.String()]),
    updated_at: Type.Union([Type.Date(), Type.String()]),
    deleted_at: Type.Optional(Type.Union([Type.Date(), Type.String(), Type.Null()])),
    deleted_by: Type.Optional(Type.Union([Type.Number(), Type.Null()])),
});

export const EntityListResponseSchema = Type.Object({
    data: Type.Array(EntityListItemResponseSchema),
    meta: CursorMetaSchema,
});

export const EntityPickerResponseSchema = Type.Object({
    id: Type.String(),
    businessName: Type.String(),
    taxId: Type.String(),
    taxIdType: Type.Optional(Type.Union([Type.String(), Type.Null()])),
    personType: Type.Optional(Type.Union([Type.String(), Type.Null()])),
    isClient: Type.Optional(Type.Union([Type.Boolean(), Type.Null()])),
    isSupplier: Type.Optional(Type.Union([Type.Boolean(), Type.Null()])),
    isEmployee: Type.Optional(Type.Union([Type.Boolean(), Type.Null()])),
    isCarrier: Type.Optional(Type.Union([Type.Boolean(), Type.Null()])),
});

export const EntityReferencesResponseSchema = Type.Object({
    supplierProducts: Type.Number(),
    invoices: Type.Number(),
    workOrders: Type.Number(),
    total: Type.Number(),
    canDelete: Type.Boolean(),
});

// Employee Schedules
export const EmployeeScheduleReportQuerySchema = Type.Object({
    start_date: Type.Optional(Type.String()),
    end_date: Type.Optional(Type.String()),
    employee_id: Type.Optional(Type.String()),
});

export const EntityDetailContactResponseSchema = Type.Object({
    id: Type.Number(),
    entity_id: Type.Optional(Type.String()),
    name: Type.String(),
    position: Type.Optional(Type.Union([Type.String(), Type.Null()])),
    email: Type.Optional(Type.Union([Type.String(), Type.Null()])),
    phone: Type.Optional(Type.Union([Type.String(), Type.Null()])),
    is_primary: Type.Optional(Type.Union([Type.Boolean(), Type.Null()])),
});

export const EntityDetailAddressResponseSchema = Type.Object({
    id: Type.Number(),
    entity_id: Type.Optional(Type.String()),
    address_line: Type.String(),
    country: Type.String(),
    country_code: Type.Optional(Type.Union([Type.String(), Type.Null()])),
    state: Type.Optional(Type.Union([Type.String(), Type.Null()])),
    city: Type.Optional(Type.Union([Type.String(), Type.Null()])),
    parish: Type.Optional(Type.Union([Type.String(), Type.Null()])),
    postal_code: Type.Optional(Type.Union([Type.String(), Type.Null()])),
    is_main: Type.Optional(Type.Union([Type.Boolean(), Type.Null()])),
});

export const EntityDetailEmployeeDetailsResponseSchema = Type.Object({
    entity_id: Type.Optional(Type.String()),
    department_id: Type.Optional(Type.Union([Type.Number(), Type.Null()])),
    department_name: Type.Optional(Type.Union([Type.String(), Type.Null()])),
    job_title_id: Type.Optional(Type.Union([Type.Number(), Type.Null()])),
    job_title_name: Type.Optional(Type.Union([Type.String(), Type.Null()])),
    reports_to: Type.Optional(Type.Union([Type.String(), Type.Null()])),
    reports_to_name: Type.Optional(Type.Union([Type.String(), Type.Null()])),
    hire_date: Type.Optional(Type.Union([Type.String(), Type.Null()])),
    termination_date: Type.Optional(Type.Union([Type.String(), Type.Null()])),
    contract_type: Type.Optional(Type.Union([Type.String(), Type.Null()])),
    salary_type: Type.Optional(Type.Union([Type.String(), Type.Null()])),
    salary_base: Type.Optional(Type.Union([Type.String(), Type.Number(), Type.Null()])),
    cost_per_hour: Type.Optional(Type.Union([Type.String(), Type.Number(), Type.Null()])),
    accumulate_thirteenth: Type.Optional(Type.Union([Type.Boolean(), Type.Null()])),
    accumulate_fourteenth: Type.Optional(Type.Union([Type.Boolean(), Type.Null()])),
    accumulate_reserve_funds: Type.Optional(Type.Union([Type.Boolean(), Type.Null()])),
    iess_code: Type.Optional(Type.Union([Type.String(), Type.Null()])),
    dependents_count: Type.Optional(Type.Union([Type.Number(), Type.Null()])),
    bank_name: Type.Optional(Type.Union([Type.String(), Type.Null()])),
    bank_account_type: Type.Optional(Type.Union([Type.String(), Type.Null()])),
    bank_account_number: Type.Optional(Type.Union([Type.String(), Type.Null()])),
    notes: Type.Optional(Type.Union([Type.String(), Type.Null()])),
});

export const EntityDetailVehicleResponseSchema = Type.Object({
    id: Type.Number(),
    company_id: Type.Optional(Type.Number()),
    carrier_id: Type.Optional(Type.Union([Type.String(), Type.Null()])),
    license_plate: Type.String(),
    description: Type.Optional(Type.Union([Type.String(), Type.Null()])),
    is_active: Type.Optional(Type.Union([Type.Boolean(), Type.Null()])),
});

export const EntityDetailDriverResponseSchema = Type.Object({
    id: Type.Number(),
    carrier_id: Type.Optional(Type.String()),
    identification_number: Type.String(),
    full_name: Type.String(),
    phone: Type.Optional(Type.Union([Type.String(), Type.Null()])),
    is_active: Type.Optional(Type.Union([Type.Boolean(), Type.Null()])),
});

export const EntityDetailResponseSchema = Type.Object({
    id: Type.String(),
    company_id: Type.Optional(Type.Number()),
    tax_id: Type.String(),
    tax_id_type: Type.String(),
    person_type: Type.String(),
    business_name: Type.String(),
    trade_name: Type.Optional(Type.Union([Type.String(), Type.Null()])),
    email_billing: Type.Optional(Type.Union([Type.String(), Type.Null()])),
    phone: Type.Optional(Type.Union([Type.String(), Type.Null()])),
    is_client: Type.Optional(Type.Union([Type.Boolean(), Type.Null()])),
    is_supplier: Type.Optional(Type.Union([Type.Boolean(), Type.Null()])),
    is_employee: Type.Optional(Type.Union([Type.Boolean(), Type.Null()])),
    is_carrier: Type.Optional(Type.Union([Type.Boolean(), Type.Null()])),
    is_system: Type.Optional(Type.Union([Type.Boolean(), Type.Null()])),
    tax_regime_type: Type.Optional(Type.Union([Type.String(), Type.Null()])),
    obligado_contabilidad: Type.Optional(Type.Union([Type.Boolean(), Type.Null()])),
    is_retention_agent: Type.Optional(Type.Union([Type.Boolean(), Type.Null()])),
    is_special_contributor: Type.Optional(Type.Union([Type.Boolean(), Type.Null()])),
    default_price_list_id: Type.Optional(Type.Union([Type.Number(), Type.Null()])),
    is_active: Type.Optional(Type.Union([Type.Boolean(), Type.Null()])),
    created_at: Type.Optional(Type.Union([Type.Date(), Type.String(), Type.Null()])),
    updated_at: Type.Optional(Type.Union([Type.Date(), Type.String(), Type.Null()])),
    deleted_at: Type.Optional(Type.Union([Type.Date(), Type.String(), Type.Null()])),
    deleted_by: Type.Optional(Type.Union([Type.Number(), Type.Null()])),
    contacts: Type.Optional(Type.Array(EntityDetailContactResponseSchema)),
    addresses: Type.Optional(Type.Array(EntityDetailAddressResponseSchema)),
    employeeDetails: Type.Optional(Type.Union([EntityDetailEmployeeDetailsResponseSchema, Type.Null()])),
    vehicles: Type.Optional(Type.Array(EntityDetailVehicleResponseSchema)),
    drivers: Type.Optional(Type.Array(EntityDetailDriverResponseSchema)),
});


export const EntityLookupResponseSchema = Type.Union([EntityDetailResponseSchema, Type.Null()]);

// ============================================================================
// CANONICAL INFERRED TYPES (Single Source of Truth)
// ============================================================================

export type EntityBodyType = Static<typeof EntityBodySchema>;
export type EntityUpdateType = Static<typeof EntityUpdateBodySchema>;
export type EntityDetailType = Static<typeof EntityDetailResponseSchema>;
export type EntityLookupResponseType = Static<typeof EntityLookupResponseSchema>;
export type EntityListItemType = Static<typeof EntityListItemResponseSchema>;
export type EntityListResponseType = Static<typeof EntityListResponseSchema>;

export type EntityContactType = Static<typeof ContactBodySchema>;
export type EntityAddressType = Static<typeof AddressBodySchema>;

export type EntityEmployeeDetailsType = Static<typeof EmployeeDetailsBodySchema>;

export type CarrierVehicleType = Static<typeof CarrierVehicleBodySchema>;
export type CarrierDriverType = Static<typeof CarrierDriverBodySchema>;

export type EntityPickerType = Static<typeof EntityPickerResponseSchema>;
export type EntityPickerQueryType = Static<typeof EntityPickerQuerySchema>;
export type EntityReferencesType = Static<typeof EntityReferencesResponseSchema>;

export type DepartmentType = Static<typeof DepartmentBodySchema>;
export type DepartmentDetailType = Static<typeof DepartmentResponseSchema>;

export type JobTitleType = Static<typeof JobTitleBodySchema>;
export type JobTitleDetailType = Static<typeof JobTitleResponseSchema>;

export type { EntityType } from '../enums';