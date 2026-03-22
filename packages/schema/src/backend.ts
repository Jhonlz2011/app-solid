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

// ============================================================================
// ENTITY CRUD SCHEMAS
// ============================================================================

export const ContactPayloadSchema = Type.Object({
    name: Type.String(),
    position: Type.Optional(Type.String()),
    email: Type.Optional(Type.Union([Type.String({ format: 'email' }), Type.Literal('')])),
    phone: Type.Optional(Type.String()),
    isPrimary: Type.Optional(Type.Boolean())
});

export const AddressPayloadSchema = Type.Object({
    addressLine: Type.String(),
    city: Type.Optional(Type.String()),
    country: Type.Optional(Type.String()),
    countryCode: Type.Optional(Type.String()),
    postalCode: Type.Optional(Type.String()),
    isMain: Type.Optional(Type.Boolean())
});

// Supplier create/update body schema
// Note: Aligns with frontend EntityFormSchema in packages/schema/src/frontend.ts
export const SupplierBodySchema = Type.Object({
    taxId: Type.String(),
    taxIdType: TaxIdTypeSchema,
    personType: PersonTypeSchema, // Required - form provides default
    businessName: Type.String(),
    tradeName: Type.Optional(Type.String()), // Optional - may be empty string
    emailBilling: Type.Optional(Type.Union([Type.String({ format: 'email' }), Type.Literal('')])),
    phone: Type.Optional(Type.String()), // Optional - may be empty string
    // Role flags
    isClient: Type.Optional(Type.Boolean()),
    isSupplier: Type.Optional(Type.Boolean()),
    isEmployee: Type.Optional(Type.Boolean()),
    isCarrier: Type.Optional(Type.Boolean()),
    // Tax (SRI)
    taxRegimeType: Type.Optional(TaxRegimeTypeSchema), // Optional enum
    obligadoContabilidad: Type.Optional(Type.Boolean()), // Optional - defaults to false in form
    isRetentionAgent: Type.Optional(Type.Boolean()),
    isSpecialContributor: Type.Optional(Type.Boolean()),
    // Employee Details (optional sub-object)
    employeeDetails: Type.Optional(Type.Object({
        department: Type.Optional(Type.String()),
        jobTitle: Type.Optional(Type.String()),
        salaryBase: Type.Optional(Type.Number()),
        hireDate: Type.Optional(Type.String()),
        costPerHour: Type.Optional(Type.Number()),
    })),
    contacts: Type.Optional(Type.Array(ContactPayloadSchema)),
    addresses: Type.Optional(Type.Array(AddressPayloadSchema)),
});

/** Alias for backward compatibility */
export const EntityBodySchema = SupplierBodySchema;

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
    sessionId: Type.String(),
});

export type PublicUserType = Static<typeof PublicUser>;
export type AuthUserResponseType = Static<typeof AuthUserResponse>;
export type AuthResponseDtoType = Static<typeof AuthResponseDto>;


// --- SRI MODULE ---
export const SriSupplierResponseSchema = Type.Object({
    ruc: Type.String(),
    razonSocial: Type.String(),
    nombreComercial: Type.Union([Type.String(), Type.Null()]),
    city: Type.Union([Type.String(), Type.Null()]),
    isActive: Type.Union([Type.Boolean(), Type.Null()]),
    isSociedad: Type.Union([Type.Boolean(), Type.Null()]),
    isRimpe: Type.Union([Type.Boolean(), Type.Null()]),
    obligadoContabilidad: Type.Union([Type.Boolean(), Type.Null()]),
    agenteRetencion: Type.Union([Type.Boolean(), Type.Null()]),
    contribuyenteEspecial: Type.Union([Type.Boolean(), Type.Null()]),
});

export type SriSupplierResponseType = Static<typeof SriSupplierResponseSchema>;

// --- RBAC Permission Schemas ---
// Uses explicit literals to avoid Eden inference collapse (same pattern as TaxIdTypeSchema)
import { RBAC_MODULES, RBAC_ACTIONS } from './enums';

export const PermissionSlugSchema = Type.Union(
    RBAC_MODULES.flatMap(m =>
        RBAC_ACTIONS.map(a => Type.Literal(`${m}.${a}` as const))
    )
);

// --- AUDIT LOG Response Schemas ---
export const AuditLogEntrySchema = Type.Object({
    id: Type.Number(),
    action: Type.String(),
    targetType: Type.String(),
    targetId: Type.Union([Type.Number(), Type.Null()]),
    details: Type.Union([Type.String(), Type.Null()]),
    ipAddress: Type.Union([Type.String(), Type.Null()]),
    createdAt: Type.Date(),
    performedBy: Type.Number(),
    performedByUsername: Type.Union([Type.String(), Type.Null()]),
});

export const AuditLogResponseSchema = Type.Object({
    data: Type.Array(AuditLogEntrySchema),
    meta: Type.Object({
        total: Type.Number(),
        page: Type.Number(),
        pageCount: Type.Number(),
        hasNextPage: Type.Boolean(),
        hasPrevPage: Type.Boolean(),
    }),
});

export type AuditLogEntryType = Static<typeof AuditLogEntrySchema>;
export type AuditLogResponseType = Static<typeof AuditLogResponseSchema>;

// --- ENTITY PICKER Response Schema ---
export const EntityPickerItemSchema = Type.Object({
    id: Type.Number(),
    businessName: Type.String(),
    taxId: Type.String(),
});

export type EntityPickerItemType = Static<typeof EntityPickerItemSchema>;

