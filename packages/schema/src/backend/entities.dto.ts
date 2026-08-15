import { Type, type Static } from '@sinclair/typebox';
import type { EntityPayload } from '../dto/entities.dto';

// ============================================================================
// ENTITY ENUMS & SUB-SCHEMAS (TypeBox for Elysia routes)
// ============================================================================

export const TaxIdTypeSchema = Type.Union([
    Type.Literal('RUC'),
    Type.Literal('CEDULA'),
    Type.Literal('PASAPORTE'),
    Type.Literal('CONSUMIDOR_FINAL'),
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

export const ContactPayloadSchema = Type.Object({
    name: Type.String(),
    position: Type.String(),
    email: Type.Union([Type.String({ format: 'email' }), Type.Literal('')]),
    phone: Type.String(),
    isPrimary: Type.Boolean()
});

export const AddressPayloadSchema = Type.Object({
    addressLine: Type.String(),
    city: Type.String(),
    country: Type.String(),
    countryCode: Type.String(),
    postalCode: Type.String(),
    isMain: Type.Boolean()
});

export const EmployeeDetailsPayloadSchema = Type.Object({
    department: Type.String(),
    jobTitle: Type.String(),
    salaryBase: Type.Optional(Type.Number()),
    hireDate: Type.String(),
    costPerHour: Type.Optional(Type.Number()),
});

export const CarrierVehiclePayloadSchema = Type.Object({
    licensePlate: Type.String(),
    description: Type.Optional(Type.String()),
    isActive: Type.Optional(Type.Boolean()),
});

export const CarrierVehicleUpdateSchema = Type.Partial(CarrierVehiclePayloadSchema);

export const CarrierDriverPayloadSchema = Type.Object({
    identificationNumber: Type.String(),
    fullName: Type.String(),
    phone: Type.Optional(Type.String()),
    isActive: Type.Optional(Type.Boolean()),
});

// Main Entity Form Schema (TypeBox) - Aligned strictly with frontend Valibot schema
export const EntityFormSchema = Type.Object({
    taxId: Type.String(),
    taxIdType: TaxIdTypeSchema,
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
    
    employeeDetails: Type.Optional(EmployeeDetailsPayloadSchema),
    contacts: Type.Array(ContactPayloadSchema),
    addresses: Type.Array(AddressPayloadSchema),
    vehicles: Type.Optional(Type.Array(CarrierVehiclePayloadSchema)),
    drivers: Type.Optional(Type.Array(CarrierDriverPayloadSchema)),
});

// Compile-Time Assertions
type AssertTypeBox<T extends EntityPayload> = T;
const _checkEntityBodySchema: AssertTypeBox<Static<typeof EntityFormSchema>> = {} as any as Static<typeof EntityFormSchema>;

export const EntityUpdateSchema = Type.Partial(Type.Omit(EntityFormSchema, ['taxId', 'taxIdType']));

export const EntityPickerQuerySchema = Type.Object({
    search: Type.Optional(Type.String()),
    limit: Type.Optional(Type.Number()),
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
});

export const EntityFacetsQuerySchema = Type.Object({
    search: Type.Optional(Type.String()),
    personType: Type.Optional(Type.String()),
    taxIdType: Type.Optional(Type.String()),
    isActive: Type.Optional(Type.String()),
    businessName: Type.Optional(Type.String()),
});

export const EntityPickerItemSchema = Type.Object({
    id: Type.Number(),
    businessName: Type.String(),
    taxId: Type.String(),
});

export type EntityFormType = Static<typeof EntityFormSchema>;
export type EntityUpdateType = Static<typeof EntityUpdateSchema>;
export type EntityPickerQueryType = Static<typeof EntityPickerQuerySchema>;
export type EntityListQueryType = Static<typeof EntityListQuerySchema>;
export type EntityFacetsQueryType = Static<typeof EntityFacetsQuerySchema>;
export type EntityPickerItemType = Static<typeof EntityPickerItemSchema>;

// Employee Schedules
export const EmployeeScheduleReportQuerySchema = Type.Object({
    start_date: Type.Optional(Type.String()),
    end_date: Type.Optional(Type.String()),
    employee_id: Type.Optional(Type.String()),
});

export const EmployeeScheduleCreateSchema = Type.Object({
    employee_id: Type.Number(),
    work_order_id: Type.Optional(Type.Number()),
    work_date: Type.String(),
    hours_normal: Type.Optional(Type.Number()),
    hours_supplementary: Type.Optional(Type.Number()),
    hours_extraordinary: Type.Optional(Type.Number()),
    labor_cost: Type.Optional(Type.String()),
    project_expense: Type.Optional(Type.String()),
    justification: Type.Optional(Type.String()),
});

export const EmployeeScheduleUpdateSchema = Type.Object({
    hours_normal: Type.Optional(Type.Number()),
    hours_supplementary: Type.Optional(Type.Number()),
    hours_extraordinary: Type.Optional(Type.Number()),
    labor_cost: Type.Optional(Type.String()),
    project_expense: Type.Optional(Type.String()),
    justification: Type.Optional(Type.String()),
});

export type EmployeeScheduleCreateType = Static<typeof EmployeeScheduleCreateSchema>;
export type EmployeeScheduleUpdateType = Static<typeof EmployeeScheduleUpdateSchema>;
