import { pipe, string, minLength, object, email, picklist, boolean, union, literal, optional, nullable, regex, any, type InferInput } from 'valibot';
import { TaxRegimeTypeSchema } from './entities.schema';

// --- 1. BRANDING & APARIENCIA ---
export const BrandingSettingsFormSchema = object({
    primaryColor: pipe(string(), minLength(4, 'Color primario inválido')),
    themeColor: pipe(string(), minLength(4, 'Color de tema inválido')),
    loginBgUrl: optional(nullable(any())),
});
export type BrandingSettingsFormData = InferInput<typeof BrandingSettingsFormSchema>;

// --- 2. PERFIL COMERCIAL / DATOS DE EMPRESA ---
export const CompanyProfileFormSchema = object({
    businessName: pipe(string(), minLength(3, 'Razón social requerida')),
    tradeName: optional(nullable(string())),
    ruc: pipe(string(), regex(/^\d{13}$/, 'RUC debe tener 13 dígitos numéricos')),
    mainAddress: pipe(string(), minLength(5, 'Dirección matriz requerida')),
    businessType: optional(nullable(string())),
    email: optional(nullable(union([pipe(string(), email('Correo inválido')), literal('')]))),
    phone: optional(nullable(string())),
    logoUrl: optional(nullable(any())),
});
export type CompanyProfileFormData = InferInput<typeof CompanyProfileFormSchema>;

// --- 3. INFORMACIÓN FISCAL TRIBUTARIA ---
export const FiscalSettingsFormSchema = object({
    obligadoContabilidad: boolean(),
    contribuyenteEspecial: optional(nullable(string())),
    agenteRetencion: optional(nullable(string())),
    rimpeType: optional(nullable(TaxRegimeTypeSchema)),
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
