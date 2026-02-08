import { createSelectSchema, createInsertSchema } from 'drizzle-valibot';
import { pipe, string, minLength, maxLength, number, minValue, object, email, type InferInput, picklist, undefinedable, boolean } from 'valibot';
import * as tables from './tables';
import { TAX_ID_TYPES, PERSON_TYPES, SRI_CONTRIBUTOR_TYPES } from './enums';

// Re-export enum types for frontend convenience
export { type TaxIdType, type PersonType, type SriContributorType } from './enums';

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

// --- SUPPLIER FORM SCHEMAS ---
// Reusable enum schemas - using centralized values
export const TaxIdTypeSchema = picklist(TAX_ID_TYPES);
export const PersonTypeSchema = picklist(PERSON_TYPES);
export const SriContributorTypeSchema = picklist(SRI_CONTRIBUTOR_TYPES);

// Complete supplier form validation schema
// Note: Using string() for optional text fields because TanStack Form uses empty strings.
// Using undefinedable() for enum to keep the key required (matching defaultValues) while allowing undefined.
export const SupplierFormSchema = object({
    taxId: pipe(string(), minLength(10, 'RUC/Cédula debe tener al menos 10 caracteres')),
    taxIdType: TaxIdTypeSchema,
    personType: PersonTypeSchema,
    businessName: pipe(string(), minLength(3, 'Razón social requerida')),
    tradeName: string(),
    emailBilling: pipe(string(), minLength(1, 'Email requerido')),
    phone: string(),
    addressFiscal: pipe(string(), minLength(1, 'Dirección requerida')),
    sriContributorType: undefinedable(SriContributorTypeSchema), // Required key, optional value
    obligadoContabilidad: boolean(),
});

export type SupplierFormData = InferInput<typeof SupplierFormSchema>;

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
