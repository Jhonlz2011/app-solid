import { pipe, string, minLength, object, email, picklist, boolean, union, literal, optional, nullable, regex, any, type InferInput } from 'valibot';
import { TaxRegimeTypeSchema } from './entities.schema';

// --- COMPANY SETTINGS FORM SCHEMA ---
export const CompanySettingsFormSchema = object({
    // Branding & Apariencia
    logoUrl: optional(nullable(any())),
    loginBgUrl: optional(nullable(any())),
    primaryColor: pipe(string(), minLength(4, 'Color primario inválido')),
    themeColor: pipe(string(), minLength(4, 'Color de tema inválido')),
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
    rimpeType: optional(nullable(TaxRegimeTypeSchema)),
    sriEnvironment: picklist(['1', '2']),
});

export type CompanySettingsFormData = InferInput<typeof CompanySettingsFormSchema>;
