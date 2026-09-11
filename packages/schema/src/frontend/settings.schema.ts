import { pipe, string, minLength, object, email, picklist, boolean, union, literal, optional, nullable, regex, custom, type InferInput } from 'valibot';
import { TaxRegimeTypeSchema } from './entities.schema';
import { RucFormatSchema, EmailFormatSchema } from './auth.schema';

/** Accepts a remote image URL string or a local File upload instance */
export const ImageSourceSchema = optional(
    nullable(
        custom<string | File>(
            (v) => typeof v === 'string' || (typeof File !== 'undefined' && v instanceof File),
            'Debe ser una URL válida o un archivo'
        )
    )
);

// --- 1. BRANDING & APARIENCIA ---
export const BrandingSettingsFormSchema = object({
    primaryColor: pipe(string(), minLength(4, 'Color primario inválido')),
    themeColor: pipe(string(), minLength(4, 'Color de tema inválido')),
    loginBgUrl: ImageSourceSchema,
});
export type BrandingSettingsFormData = InferInput<typeof BrandingSettingsFormSchema>;

// --- 2. PERFIL COMERCIAL / DATOS DE EMPRESA ---
export const CompanyProfileFormSchema = object({
    businessName: pipe(string(), minLength(3, 'Razón social requerida')),
    tradeName: optional(nullable(string())),
    ruc: RucFormatSchema,
    mainAddress: pipe(string(), minLength(5, 'Dirección matriz requerida')),
    businessType: optional(nullable(string())),
    email: optional(nullable(union([EmailFormatSchema, literal('')]))),
    phone: optional(nullable(string())),
    logoUrl: ImageSourceSchema,
});
export type CompanyProfileFormData = InferInput<typeof CompanyProfileFormSchema>;

// --- 3. INFORMACIÓN FISCAL TRIBUTARIA ---
export const FiscalSettingsFormSchema = object({
    obligadoContabilidad: boolean(),
    contribuyenteEspecial: optional(nullable(string())),
    agenteRetencion: optional(nullable(string())),
    taxRegimeType: optional(nullable(TaxRegimeTypeSchema)),
    sriEnvironment: picklist(['1', '2']),
});
export type FiscalSettingsFormData = InferInput<typeof FiscalSettingsFormSchema>;

// --- 4. UNIFIED COMPANY SETTINGS FORM SCHEMA (Retrocompatibilidad) ---
export const CompanySettingsFormSchema = object({
    ...BrandingSettingsFormSchema.entries,
    ...CompanyProfileFormSchema.entries,
    ...FiscalSettingsFormSchema.entries,
});

export type CompanySettingsFormData = InferInput<typeof CompanySettingsFormSchema>;

// --- 5. MENU & NAVIGATION FORM SCHEMA ---
export const MenuItemFormSchema = object({
    label: pipe(string(), minLength(1, 'El nombre o etiqueta es requerido')),
    path_alias: optional(nullable(string())),
    icon: optional(nullable(string())),
});

export type MenuItemFormData = InferInput<typeof MenuItemFormSchema>;

