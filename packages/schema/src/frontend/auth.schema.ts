import { pipe, string, minLength, maxLength, trim, object, email, picklist, boolean, optional, regex, type InferInput } from 'valibot';
import { TAX_REGIME_TYPES } from '../enums';

// --- AUTH LOGIN ---
export const AuthLoginSchema = object({
    email: pipe(string(), minLength(1, 'Usuario o correo es requerido')),
    password: pipe(string(), minLength(8, 'La contraseña debe tener al menos 8 caracteres')),
});

// --- REGISTRATION STEP SCHEMAS ---
export const RegisterStep1Schema = object({
    fullName: pipe(string(), trim(), minLength(3, 'Mínimo 3 caracteres')),
    username: pipe(string(), trim(), minLength(3, 'Mínimo 3 caracteres'), maxLength(30, 'Máximo 30 caracteres'),
        regex(/^[a-z0-9._-]+$/, 'Solo minúsculas, números, puntos, guiones')),
    email: pipe(string(), trim(), email('Email inválido')),
    password: pipe(string(), minLength(8, 'Mínimo 8 caracteres')),
    phone: optional(pipe(string(), regex(/^09\d{8}$/, 'Celular inválido (09XXXXXXXX)'))),
    cedula: optional(pipe(string(), regex(/^\d{10}$/, 'La cédula debe tener 10 dígitos numéricos'))),
});

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

export type AuthLoginFormData = InferInput<typeof AuthLoginSchema>;
export type RegisterStep1Data = InferInput<typeof RegisterStep1Schema>;
export type RegisterStep2Data = InferInput<typeof RegisterStep2Schema>;
