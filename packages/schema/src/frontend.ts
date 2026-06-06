import { createSelectSchema, createInsertSchema } from 'drizzle-valibot';
import { pipe, string, minLength, maxLength, trim, object, email, type InferInput, picklist, undefinedable, boolean, union, literal, array, number, optional, nullable, forward, check, partialCheck, any, partial, regex } from 'valibot';
import * as tables from './tables';
import { TAX_ID_TYPES, TAX_ID_TYPES_FORM, PERSON_TYPES, TAX_REGIME_TYPES, PRODUCT_TYPES, PRODUCT_SUBTYPES, ATTRIBUTE_DATA_TYPES, UOM_GROUPS, LOCATION_TYPES } from './enums';

// Re-export enum types for frontend convenience
export { type TaxIdType, type TaxIdTypeForm, type PersonType, type TaxRegimeType } from './enums';
export { type RbacModule, type RbacAction, type PermissionSlug } from './enums';
export { type ProductType, type ProductSubtype } from './enums';
export { TAX_ID_TYPES_FORM, PRODUCT_TYPES, PRODUCT_SUBTYPES, ATTRIBUTE_DATA_TYPES, UOM_GROUPS, LOCATION_TYPES } from './enums';
export { type AttributeDataType, type UomGroup } from './enums';

// --- PRODUCTS ---
export const ProductSelect = createSelectSchema(tables.products);
export const ProductInsert = createInsertSchema(tables.products, {
    slug: pipe(string(), minLength(1, 'Slug es requerido')),
    name: pipe(string(), minLength(1, 'Nombre es requerido')),
});

// --- PRODUCT VARIANT SELECT/INSERT ---
export const ProductVariantSelect = createSelectSchema(tables.productVariants);
export const ProductVariantInsert = createInsertSchema(tables.productVariants, {
    sku: pipe(string(), minLength(1, 'SKU es requerido')),
});

// --- PRODUCT FORM SCHEMAS (Valibot) ---

// Variant sub-form — unified: each variant IS a SKU with attributes + packaging
export const ProductVariantFormSchema = object({
    id: optional(nullable(number())),  // null = new, number = existing (for sync)
    // Identification
    sku: pipe(string(), minLength(1, 'SKU es requerido')),
    variant_name: optional(nullable(string())),
    // JSONB — dynamic differentiating attributes
    // Ej: { "diametro": "1/4", "diametro_num": 0.25 }
    variant_attributes: optional(any()),
    // Packaging / Content (absorbed from presentations)
    content_quantity: number('Cantidad de contenido requerida'),
    sale_uom_id: optional(nullable(number())),
    // Pricing
    base_price: optional(nullable(number())),
    last_cost: optional(nullable(number())),
    // Identification
    barcode: optional(nullable(string())),
    image_urls: optional(nullable(array(string()))),
    // Dimensional tracking
    std_length_cm: optional(nullable(number())),
    std_width_cm: optional(nullable(number())),
    // Flags
    is_default: boolean(),
    is_active: boolean(),
    sort_order: optional(number()),
});

// Main product form — the parent merchandising entity
export const ProductFormSchema = object({
    // Classification
    product_type: picklist(PRODUCT_TYPES, 'Tipo de producto requerido'),
    product_subtype: optional(nullable(picklist(PRODUCT_SUBTYPES))),
    category_id: number('Categoría es requerida'),
    brand_id: optional(nullable(number())),
    // Identification
    slug: string(),  // Can be empty — auto-generated from generateSku() on submit
    name: pipe(string(), minLength(1, 'Nombre es requerido')),
    description: optional(nullable(string())),
    // Shared attributes (JSONB — common to all variants)
    shared_attributes: optional(any()),
    extra_specs: optional(any()),
    image_urls: optional(array(string())),
    // UOM & Inventory
    uom_inventory_id: number('UOM de inventario es requerida'),
    has_dimensional_tracking: boolean(),
    min_stock_alert: optional(nullable(number())),
    // Pricing defaults
    default_base_price: number('Precio base requerido'),
    iva_rate_code: number(),
    is_active: boolean(),
    // Variants (each variant = 1 SKU with attributes + packaging)
    variants: array(ProductVariantFormSchema),
});

export type ProductFormData = InferInput<typeof ProductFormSchema>;
export type ProductVariantFormData = InferInput<typeof ProductVariantFormSchema>;

// --- ATTRIBUTE DEFINITIONS ---
export const RenameOptionEntry = object({
    from: string(),
    to: string(),
});

export const AttributeFormSchema = pipe(
    object({
        label: pipe(string(), minLength(1, 'La etiqueta es requerida')),
        type: picklist(ATTRIBUTE_DATA_TYPES, 'Tipo de dato requerido'),
        defaultOptions: optional(array(string())),
        renamedOptions: optional(array(RenameOptionEntry)),
    }),
    forward(
        check(
            (input) => {
                if (input.type === 'SELECT') {
                    return Array.isArray(input.defaultOptions) && input.defaultOptions.length > 0;
                }
                return true;
            },
            'Debe agregar al menos una opción para el tipo Selección.'
        ),
        ['defaultOptions']
    )
);

export type AttributeFormData = InferInput<typeof AttributeFormSchema>;

// --- CATEGORIES ---
export const CategoryAttributeEntrySchema = object({
    attributeDefId: number(),
    required: boolean(),
    order: number(),
    specificOptions: optional(any()),
});

export const CategoryFormSchema = object({
    name: pipe(string(), minLength(1, 'El nombre es requerido')),
    parentId: optional(nullable(number())),
    description: optional(nullable(string())),
    icon: optional(nullable(string())),
    nameTemplate: optional(nullable(string())),
    sortOrder: optional(number()),
    attributes: array(CategoryAttributeEntrySchema),
});

export const CategoryUpdateSchema = partial(CategoryFormSchema);

export type CategoryFormData = InferInput<typeof CategoryFormSchema>;
export type CategoryUpdateData = InferInput<typeof CategoryUpdateSchema>;
export type CategoryAttributeEntry = InferInput<typeof CategoryAttributeEntrySchema>;

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

// --- SETTINGS FORM SCHEMAS (Valibot) ---

export const BrandFormSchema = object({
    name: pipe(string(), trim(), minLength(1, 'El nombre es requerido')),
    website: optional(nullable(string())),
});
export type BrandFormData = InferInput<typeof BrandFormSchema>;

export const FamilyFormSchema = object({
    name: pipe(string(), trim(), minLength(1, 'El nombre es requerido')),
    categoryId: optional(nullable(number())),
    description: optional(nullable(string())),
});
export type FamilyFormData = InferInput<typeof FamilyFormSchema>;

export const WarehouseFormSchema = object({
    code: pipe(string(), trim(), minLength(1, 'El código es requerido'), maxLength(20, 'Máx 20 caracteres')),
    name: pipe(string(), trim(), minLength(1, 'El nombre es requerido'), maxLength(100, 'Máx 100 caracteres')),
    address: optional(nullable(string())),
    is_mobile: boolean(),
});
export type WarehouseFormData = InferInput<typeof WarehouseFormSchema>;

export const LocationFormSchema = object({
    name: pipe(string(), trim(), minLength(1, 'El nombre es requerido'), maxLength(100, 'Máx 100 caracteres')),
    parent_id: optional(nullable(number())),
    warehouse_id: optional(nullable(number())),
    type: picklist(LOCATION_TYPES, 'Tipo requerido'),
});
export type LocationFormData = InferInput<typeof LocationFormSchema>;

export const UomFormSchema = object({
    code: pipe(string(), trim(), minLength(1, 'El código es requerido'), maxLength(10, 'Máx 10 caracteres')),
    name: pipe(string(), trim(), minLength(1, 'El nombre es requerido')),
    uom_group: picklist(UOM_GROUPS, 'Grupo es requerido'),
    base_factor: optional(nullable(union([string(), number()]))),
});

export type UomFormData = InferInput<typeof UomFormSchema>;

// --- AUTH DTOs ---
export const AuthLoginSchema = object({
    email: pipe(string(), minLength(1, 'Usuario o correo es requerido')),
    password: pipe(string(), minLength(8, 'La contraseña debe tener al menos 8 caracteres'))
});

export type AuthLoginDto = InferInput<typeof AuthLoginSchema>;

// --- REGISTRATION STEP SCHEMAS ---

export const RegisterStep1Schema = pipe(
    object({
        fullName: pipe(string(), trim(), minLength(3, 'Mínimo 3 caracteres')),
        email: pipe(string(), trim(), email('Email inválido')),
        emailConfirm: pipe(string(), trim(), email('Email inválido')),
        password: pipe(string(), minLength(8, 'Mínimo 8 caracteres')),
        passwordConfirm: pipe(string(), minLength(1, 'Confirma tu contraseña')),
        phone: optional(pipe(string(), regex(/^09\d{8}$/, 'Celular ecuatoriano inválido (09XXXXXXXX)'))),
        cedula: optional(string()),
    }),
    forward(
        partialCheck(
            [['email'], ['emailConfirm']],
            (input) => input.email === input.emailConfirm,
            'Los correos no coinciden'
        ),
        ['emailConfirm']
    ),
    forward(
        partialCheck(
            [['password'], ['passwordConfirm']],
            (input) => input.password === input.passwordConfirm,
            'Las contraseñas no coinciden'
        ),
        ['passwordConfirm']
    )
);

export const RegisterStep2Schema = object({
    slug: pipe(string(), trim(), minLength(3, 'Mínimo 3 caracteres'), maxLength(30, 'Máximo 30 caracteres'),
        regex(/^[a-z0-9-]+$/, 'Solo minúsculas, números y guiones')),
    ruc: pipe(string(), regex(/^\d{13}$/, 'RUC debe tener 13 dígitos numéricos')),
    businessName: pipe(string(), trim(), minLength(3, 'Mínimo 3 caracteres')),
    tradeName: optional(string()),
    businessType: pipe(string(), minLength(1, 'Seleccione tipo de negocio')),
    mainAddress: optional(string()),
    taxRegime: optional(picklist(TAX_REGIME_TYPES, 'Seleccione régimen tributario')),
    obligadoContabilidad: optional(boolean()),
    contribuyenteEspecial: optional(string()),
});

export type RegisterStep1Data = InferInput<typeof RegisterStep1Schema>;
export type RegisterStep2Data = InferInput<typeof RegisterStep2Schema>;

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

/** Create variant — same base but password is required with minLength */
export const UserCreateSchema = object({
    ...UserFormSchema.entries,
    password: pipe(string(), minLength(8, 'La contraseña debe tener al menos 8 caracteres')),
});

export type UserFormData = InferInput<typeof UserFormSchema>;
export type UserCreateData = InferInput<typeof UserCreateSchema>;

// --- PROFILE FORM SCHEMAS ---

export const UpdateProfileSchema = object({
    username: pipe(
        string(),
        trim(),
        minLength(3, 'El nombre de usuario debe tener al menos 3 caracteres'),
        maxLength(25, 'El nombre de usuario no puede exceder 25 caracteres')
    ),
    email: pipe(
        string(),
        trim(),
        email('Ingresa un email válido')
    ),
});

export const ChangePasswordSchema = pipe(
    object({
        currentPassword: pipe(
            string(),
            minLength(1, 'La contraseña actual es requerida')
        ),
        newPassword: pipe(
            string(),
            minLength(8, 'La nueva contraseña debe tener al menos 8 caracteres')
        ),
        confirmPassword: pipe(
            string(),
            minLength(1, 'Confirma tu nueva contraseña')
        ),
    }),
    forward(
        partialCheck(
            [['newPassword'], ['confirmPassword']],
            (input) => input.newPassword === input.confirmPassword,
            'Las contraseñas no coinciden'
        ),
        ['confirmPassword']
    )
);

export type UpdateProfileFormData = InferInput<typeof UpdateProfileSchema>;
export type ChangePasswordFormData = InferInput<typeof ChangePasswordSchema>;

// --- COMPANY SETTINGS FORM SCHEMA ---
export const CompanySettingsFormSchema = object({
    // Branding & Apariencia
    logoUrl: optional(nullable(any())),
    loginBgUrl: optional(nullable(any())),
    primaryColor: pipe(string(), minLength(4, 'Color primario inválido')),
    secondaryColor: pipe(string(), minLength(4, 'Color secundario inválido')),
    // Datos de Empresa
    businessName: pipe(string(), minLength(3, 'Razón social requerida')),
    tradeName: optional(nullable(string())),
    ruc: pipe(string(), regex(/^\d{13}$/, 'RUC debe tener 13 dígitos numéricos')),
    mainAddress: pipe(string(), minLength(5, 'Dirección matriz requerida')),
    businessType: optional(nullable(string())),
    email: optional(nullable(union([pipe(string(), email('Correo inválido')), literal('')]))),
    phone: optional(nullable(string())),
    // Fiscal
    obligadoContabilidad: boolean(),
    contribuyenteEspecial: optional(nullable(string())),
    agenteRetencion: optional(nullable(string())),
    rimpeType: optional(nullable(picklist(['NEGOCIO_POPULAR', 'EMPRENDEDOR', 'GENERAL', ''] as any))),
    sriEnvironment: picklist(['1', '2']),
});

export type CompanySettingsFormData = InferInput<typeof CompanySettingsFormSchema>;

