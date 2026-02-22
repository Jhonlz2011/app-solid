import { createSelectSchema, createInsertSchema } from 'drizzle-typebox';
import { Type, type Static } from '@sinclair/typebox';
import * as tables from './tables';

// ============================================================================
// SHARED ENTITY ENUM SCHEMAS (TypeBox for Elysia routes)
// ⚠️ Must use explicit Type.Literal() — generic helpers (mapped tuples,
// T[number] unions) break Eden's narrow type inference, collapsing to `never`.
// Keep values in sync with const arrays in enums.ts.
// ============================================================================

export const TaxIdTypeSchema = Type.Union([
    Type.Literal('RUC'),
    Type.Literal('CEDULA'),
    Type.Literal('PASAPORTE'),
]);

export const PersonTypeSchema = Type.Union([
    Type.Literal('NATURAL'),
    Type.Literal('JURIDICA'),
]);

export const SriContributorTypeSchema = Type.Union([
    Type.Literal('RIMPE_POPULAR'),
    Type.Literal('RIMPE_EMPRENDEDOR'),
    Type.Literal('GENERAL'),
    Type.Literal('ESP_AGENT'),
]);

// ============================================================================
// ENTITY CRUD SCHEMAS
// ============================================================================

// Supplier create/update body schema
// Note: Aligns with frontend SupplierFormSchema in packages/schema/src/frontend.ts
export const SupplierBodySchema = Type.Object({
    taxId: Type.String(),
    taxIdType: TaxIdTypeSchema,
    personType: PersonTypeSchema, // Required - form provides default
    businessName: Type.String(),
    tradeName: Type.Optional(Type.String()), // Optional - may be empty string
    emailBilling: Type.String({ format: 'email' }),
    phone: Type.Optional(Type.String()), // Optional - may be empty string
    addressFiscal: Type.String(),
    sriContributorType: Type.Optional(SriContributorTypeSchema), // Optional enum
    obligadoContabilidad: Type.Optional(Type.Boolean()), // Optional - defaults to false in form
    parteRelacionada: Type.Optional(Type.Boolean()),
});

export const SupplierUpdateSchema = Type.Partial(Type.Omit(SupplierBodySchema, ['taxId', 'taxIdType']));

// --- PRODUCTS ---
export const ProductSelect = createSelectSchema(tables.products);
export const ProductInsert = createInsertSchema(tables.products, {
    sku: Type.String({ minLength: 1, maxLength: 50 }),
    name: Type.String({ minLength: 1 }),
});

export type ProductSelectType = Static<typeof ProductSelect>;
export type ProductInsertType = Static<typeof ProductInsert>;

// --- ENTITIES ---
export const EntitySelect = createSelectSchema(tables.entities);
export const EntityInsert = createInsertSchema(tables.entities, {
    tax_id: Type.String({ minLength: 10, maxLength: 13 }),
    business_name: Type.String({ minLength: 3 }),
});

// --- WORK ORDERS ---
export const WorkOrderSelect = createSelectSchema(tables.workOrders);
export const WorkOrderInsert = createInsertSchema(tables.workOrders);

// --- INVENTORY ---
export const InventoryStockSelect = createSelectSchema(tables.inventoryStock);
export const InventoryStockInsert = createInsertSchema(tables.inventoryStock);

// --- AUTH ---
export const AuthUserSelect = createSelectSchema(tables.authUsers);
export const AuthUserInsert = createInsertSchema(tables.authUsers);

export type AuthUserSelectType = Static<typeof AuthUserSelect>;
export type AuthUserInsertType = Static<typeof AuthUserInsert>;

// --- AUTH DTOs (API Contracts) ---
export const AuthRegisterDto = Type.Object({
    email: Type.String({ format: 'email' }),
    password: Type.String({ minLength: 8 }),
    username: Type.Optional(Type.String({ minLength: 3 })),
});

export const AuthLoginDto = Type.Object({
    email: Type.String(), // Can be email or username
    password: Type.String(),
});

export const AuthChangePasswordDto = Type.Object({
    currentPassword: Type.String(),
    newPassword: Type.String({ minLength: 8 }),
});

export const AuthUpdateProfileDto = Type.Object({
    username: Type.Optional(Type.String({ minLength: 3 })),
    email: Type.Optional(Type.String({ format: 'email' })),
});

export type AuthRegisterDtoType = Static<typeof AuthRegisterDto>;
export type AuthLoginDtoType = Static<typeof AuthLoginDto>;
export type AuthChangePasswordDtoType = Static<typeof AuthChangePasswordDto>;
export type AuthUpdateProfileDtoType = Static<typeof AuthUpdateProfileDto>;

// --- PUBLIC USER (Response DTO) ---
// Excludes sensitive fields like password_hash
export const PublicUser = Type.Object({
    id: Type.Number(),
    username: Type.String(),
    email: Type.String(),
    is_active: Type.Union([Type.Boolean(), Type.Null()]),
    last_login: Type.Union([Type.Date(), Type.Null()]),
    entity_id: Type.Union([Type.Number(), Type.Null()]),
});

// We need to extend it to include relations that are not in the base table schema but returned by service
// e.g. roles, permissions, entity details
export const AuthUserResponse = Type.Composite([
    PublicUser,
    Type.Object({
        roles: Type.Array(Type.String()),
        permissions: Type.Array(Type.String()),
        entity: Type.Optional(Type.Object({
            id: Type.Number(),
            businessName: Type.String(),
            isClient: Type.Boolean(),
            isSupplier: Type.Boolean(),
            isEmployee: Type.Boolean(),
        })),
    })
]);

export const AuthResponseDto = Type.Object({
    user: AuthUserResponse,
    accessToken: Type.String(),
});

export type PublicUserType = Static<typeof PublicUser>;
export type AuthUserResponseType = Static<typeof AuthUserResponse>;
export type AuthResponseDtoType = Static<typeof AuthResponseDto>;
