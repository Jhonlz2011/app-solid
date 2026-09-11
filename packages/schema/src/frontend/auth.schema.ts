import { pipe, string, minLength, maxLength, trim, object, email, picklist, boolean, optional, regex, type InferInput } from 'valibot';
import { TAX_REGIME_TYPES } from '../enums';

// --- BASE FORMAT SCHEMAS (Used across Auth, Profile, RBAC & Pre-flight Availability Checks) ---
export const UsernameFormatSchema = pipe(
    string('El nombre de usuario es requerido'),
    trim(),
    minLength(3, 'El nombre de usuario debe tener al menos 3 caracteres'),
    maxLength(30, 'El nombre de usuario no puede exceder 30 caracteres'),
    regex(/^[a-z0-9._-]+$/, 'Solo minúsculas, números, puntos y guiones')
);

export const EmailFormatSchema = pipe(
    string('El correo electrónico es requerido'),
    trim(),
    minLength(1, 'El correo electrónico es requerido'),
    email('Ingresa un correo electrónico válido')
);

export const SlugFormatSchema = pipe(
    string('El subdominio es requerido'),
    trim(),
    minLength(3, 'El subdominio debe tener al menos 3 caracteres'),
    maxLength(30, 'El subdominio no puede exceder 30 caracteres'),
    regex(/^[a-z0-9-]+$/, 'Solo minúsculas, números y guiones')
);

export const RucFormatSchema = pipe(
    string('El RUC es requerido'),
    trim(),
    regex(/^\d{13}$/, 'El RUC debe tener 13 dígitos numéricos')
);

// --- AUTH LOGIN ---
export const AuthLoginSchema = object({
    email: pipe(string(), minLength(1, 'Usuario o correo es requerido')),
    password: pipe(string(), minLength(8, 'La contraseña debe tener al menos 8 caracteres')),
});

// --- REGISTRATION STEP SCHEMAS ---
export const RegisterStep1Schema = object({
    fullName: pipe(string(), trim(), minLength(3, 'Mínimo 3 caracteres')),
    username: UsernameFormatSchema,
    email: EmailFormatSchema,
    password: pipe(string(), minLength(8, 'Mínimo 8 caracteres')),
    phone: optional(pipe(string(), regex(/^09\d{8}$/, 'Celular inválido (09XXXXXXXX)'))),
    cedula: optional(pipe(string(), regex(/^\d{10}$/, 'La cédula debe tener 10 dígitos numéricos'))),
});

export const RegisterStep2Schema = object({
    slug: SlugFormatSchema,
    ruc: RucFormatSchema,
    businessName: pipe(string(), trim(), minLength(3, 'Mínimo 3 caracteres')),
    tradeName: optional(string()),
    businessType: pipe(string(), minLength(1, 'Seleccione tipo de negocio')),
    mainAddress: optional(string()),
    taxRegimeType: optional(picklist(TAX_REGIME_TYPES, 'Seleccione régimen tributario')),
    obligadoContabilidad: optional(boolean()),
    contribuyenteEspecial: optional(string()),
});

export type AuthLoginFormData = InferInput<typeof AuthLoginSchema>;
export type RegisterStep1Data = InferInput<typeof RegisterStep1Schema>;
export type RegisterStep2Data = InferInput<typeof RegisterStep2Schema>;
