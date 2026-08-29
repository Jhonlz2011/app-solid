import { pipe, string, minLength, email, object, boolean, array, number, optional, nullable, type InferInput } from 'valibot';

// --- USER CREATE SCHEMA (Admin creation) ---
/** Strict schema for user creation — password required (min 8 chars) */
export const UserCreateSchema = object({
    username: pipe(string(), minLength(3, 'El usuario debe tener al menos 3 caracteres')),
    email: pipe(string(), email('Correo electrónico inválido')),
    password: pipe(string(), minLength(8, 'La contraseña debe tener al menos 8 caracteres')),
    roleIds: array(number()),
    entityId: nullable(string()),
});
export type UserCreateData = InferInput<typeof UserCreateSchema>;

// --- USER UPDATE SCHEMA (Admin edit) ---
/** Strict schema for user editing — isActive toggle, no password in general update */
export const UserUpdateSchema = object({
    username: pipe(string(), minLength(3, 'El usuario debe tener al menos 3 caracteres')),
    email: pipe(string(), email('Correo electrónico inválido')),
    isActive: boolean(),
    roleIds: array(number()),
    entityId: nullable(string()),
});
export type UserUpdateData = InferInput<typeof UserUpdateSchema>;

// Backward compatibility alias if needed
export const UserFormSchema = UserUpdateSchema;
export type UserFormData = UserUpdateData;

// --- PASSWORD RESET (Admin) ---
export const UserPasswordResetSchema = object({
    newPassword: pipe(string(), minLength(8, 'La contraseña debe tener al menos 8 caracteres')),
});
export type UserPasswordResetData = InferInput<typeof UserPasswordResetSchema>;

// --- ENTITY ASSIGNMENT ---
export const UserAssignEntitySchema = object({
    entityId: optional(nullable(string())),
});
export type UserAssignEntityData = InferInput<typeof UserAssignEntitySchema>;
