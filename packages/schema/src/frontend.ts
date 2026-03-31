import { createSelectSchema, createInsertSchema } from 'drizzle-valibot';
import { pipe, string, minLength, object, email, type InferInput, picklist, undefinedable, boolean, union, literal, array, number, optional, nullable, forward, check } from 'valibot';
import * as tables from './tables';
import { TAX_ID_TYPES, TAX_ID_TYPES_FORM, PERSON_TYPES, TAX_REGIME_TYPES } from './enums';

// Re-export enum types for frontend convenience
export { type TaxIdType, type TaxIdTypeForm, type PersonType, type TaxRegimeType } from './enums';
export { type RbacModule, type RbacAction, type PermissionSlug } from './enums';
export { TAX_ID_TYPES_FORM } from './enums';

// --- PRODUCTS ---
export const ProductSelect = createSelectSchema(tables.products);
export const ProductInsert = createInsertSchema(tables.products, {
    sku: pipe(string(), minLength(1, 'SKU es requerido')),
    name: pipe(string(), minLength(1, 'Nombre es requerido')),
});

// --- ENTITIES ---
export const EntitySelect = createSelectSchema(tables.entities);
export const EntityInsert = createInsertSchema(tables.entities, {
    tax_id: pipe(string(), minLength(10, 'RUC/Cédula inválido')),
    business_name: pipe(string(), minLength(3, 'Razón social requerida')),
});

// =============================================================================
// ENTITY FORM SCHEMAS (Valibot) — Unified for all entity types
// =============================================================================

// Reusable enum schemas
export const TaxIdTypeSchema = picklist(TAX_ID_TYPES);
export const TaxIdTypeFormSchema = picklist(TAX_ID_TYPES_FORM);
export const PersonTypeSchema = picklist(PERSON_TYPES);
export const TaxRegimeTypeSchema = picklist(TAX_REGIME_TYPES);

export const ContactFormSchema = object({
    name: pipe(string(), minLength(1, 'El nombre es requerido')),
    position: string(),
    email: union([pipe(string(), email('Correo inválido')), literal('')]),
    phone: string(),
    isPrimary: boolean()
});

export const AddressFormSchema = object({
    addressLine: pipe(string(), minLength(1, 'La dirección es requerida')),
    city: string(),
    country: string(),
    countryCode: string(),
    postalCode: string(),
    isMain: boolean()
});

// Employee Details sub-schema
export const EmployeeDetailsFormSchema = object({
    department: string(),
    jobTitle: string(),
    salaryBase: optional(number()),
    hireDate: string(),
    costPerHour: optional(number()),
});

// Complete Entity form validation schema
// Cross-field validation (taxId length by taxIdType, forced personType, etc.)
// is handled reactively in the UI via createEffect — not in this schema.
// This schema validates field shapes only.
export const EntityFormSchema = pipe(
    object({
        // Identification
        taxId: pipe(string(), minLength(1, 'La identificación es requerida')),
        taxIdType: TaxIdTypeFormSchema,
        personType: PersonTypeSchema,
        // Business
        businessName: pipe(string(), minLength(3, 'Razón social requerida')),
        tradeName: string(),
        // Contact
        emailBilling: union([pipe(string(), email('Correo inválido')), literal('')]),
        phone: string(),
        // Roles
        isClient: boolean(),
        isSupplier: boolean(),
        isEmployee: boolean(),
        isCarrier: boolean(),
        // Tax (SRI)
        taxRegimeType: undefinedable(TaxRegimeTypeSchema),
        obligadoContabilidad: boolean(),
        isRetentionAgent: boolean(),
        isSpecialContributor: boolean(),
        // Employee Details (optional sub-object)
        employeeDetails: optional(EmployeeDetailsFormSchema),
        // Relations
        contacts: array(ContactFormSchema),
        addresses: array(AddressFormSchema),
    }),
    forward(
        check((input) => {
            if (input.taxIdType === 'CEDULA') return /^\d{10}$/.test(input.taxId);
            return true;
        }, 'La Cédula debe tener 10 dígitos numéricos'),
        ['taxId']
    ),
    forward(
        check((input) => {
            if (input.taxIdType === 'RUC') return /^\d{13}$/.test(input.taxId);
            return true;
        }, 'El RUC debe tener 13 dígitos numéricos'),
        ['taxId']
    ),
    forward(
        check((input) => {
            if (input.taxIdType === 'PASAPORTE') return /^[A-Za-z0-9]+$/.test(input.taxId);
            return true;
        }, 'El Pasaporte debe ser alfanumérico'),
        ['taxId']
    )
);

export type EntityFormData = InferInput<typeof EntityFormSchema>;
export type EmployeeDetailsFormData = InferInput<typeof EmployeeDetailsFormSchema>;
/** @deprecated Use EntityFormData */
export type SupplierFormData = EntityFormData;
export type ContactFormData = InferInput<typeof ContactFormSchema>;
export type AddressFormData = InferInput<typeof AddressFormSchema>;

// --- WORK ORDERS ---
export const WorkOrderSelect = createSelectSchema(tables.workOrders);
export const WorkOrderInsert = createInsertSchema(tables.workOrders);

// --- INVENTORY ---
export const InventoryStockSelect = createSelectSchema(tables.inventoryStock);
export const InventoryStockInsert = createInsertSchema(tables.inventoryStock);

// --- AUTH DTOs ---
export const AuthLoginSchema = object({
    email: pipe(string(), minLength(1, 'Usuario o correo es requerido')),
    password: pipe(string(), minLength(8, 'La contraseña debe tener al menos 8 caracteres'))
});

export type AuthLoginDto = InferInput<typeof AuthLoginSchema>;

// --- USER FORM (Admin CRUD) ---
/** Base schema — password optional (edit mode) */
export const UserFormSchema = object({
    username: pipe(string(), minLength(3, 'El usuario debe tener al menos 3 caracteres')),
    email: pipe(string(), email('Correo electrónico inválido')),
    /** Optional — only validated in create mode via UserCreateSchema */
    password: optional(string()),
    isActive: optional(boolean()),
    roleIds: array(number()),
    entityId: optional(nullable(number())),
});

/** Create variant — password required with min length */
export const UserCreateSchema = object({
    username: pipe(string(), minLength(3, 'El usuario debe tener al menos 3 caracteres')),
    email: pipe(string(), email('Correo electrónico inválido')),
    password: pipe(string(), minLength(8, 'La contraseña debe tener al menos 8 caracteres')),
    isActive: optional(boolean()),
    roleIds: array(number()),
    entityId: optional(nullable(number())),
});

export type UserFormData = InferInput<typeof UserFormSchema>;
export type UserCreateData = InferInput<typeof UserCreateSchema>;
