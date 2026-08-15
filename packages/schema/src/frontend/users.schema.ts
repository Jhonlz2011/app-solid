import { pipe, string, minLength, email, object, boolean, array, number, optional, nullable, type InferInput } from 'valibot';

// --- USER FORM (Admin CRUD) ---
/** Base schema — password optional (edit mode) */
export const UserFormSchema = object({
    username: pipe(string(), minLength(3, 'El usuario debe tener al menos 3 caracteres')),
    email: pipe(string(), email('Correo electrónico inválido')),
    password: optional(string()),
    isActive: optional(boolean()),
    roleIds: array(number()),
    entityId: optional(nullable(number())),
});

/** Create variant — password required with minLength */
export const UserCreateSchema = object({
    ...UserFormSchema.entries,
    password: pipe(string(), minLength(8, 'La contraseña debe tener al menos 8 caracteres')),
});

export type UserFormData = InferInput<typeof UserFormSchema>;
export type UserCreateData = InferInput<typeof UserCreateSchema>;
