import { pipe, string, minLength, email, object, boolean, array, number, optional, nullable, union, literal, type InferInput } from 'valibot';

// --- USER CREATE SCHEMA (Admin creation) ---
/** Strict schema for user creation — email and roles required, username/password optional for existing users */
export const UserCreateSchema = object({
    email: pipe(string(), email('Correo electrónico inválido')),
    roleIds: array(number()),
    entityId: optional(nullable(string())),
    username: optional(union([pipe(string(), minLength(3, 'El usuario debe tener al menos 3 caracteres')), literal('')])),
    password: optional(union([pipe(string(), minLength(8, 'La contraseña debe tener al menos 8 caracteres')), literal('')])),
});
export type UserCreateData = InferInput<typeof UserCreateSchema>;

// --- USER UPDATE SCHEMA (Admin edit) ---
/** Strict schema for user editing — isActive toggle, roleIds, entityId scoped to tenant */
export const UserUpdateSchema = object({
    isActive: boolean(),
    roleIds: array(number()),
    entityId: optional(nullable(string())),
    username: optional(string()),
    email: optional(string()),
});
export type UserUpdateData = InferInput<typeof UserUpdateSchema>;

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

// --- ROLE SCHEMAS ---
export const RoleCreateSchema = object({
    name: pipe(string(), minLength(2, 'El nombre del rol debe tener al menos 2 caracteres')),
    description: optional(nullable(string())),
});

export type RoleCreateData = InferInput<typeof RoleCreateSchema>;

export const RoleUpdateSchema = object({
    name: pipe(string(), minLength(2, 'El nombre del rol debe tener al menos 2 caracteres')),
    description: optional(nullable(string())),
});
export type RoleUpdateData = InferInput<typeof RoleUpdateSchema>;

export const RolePermissionsUpdateSchema = object({
    permissionIds: array(number()),
});
export type RolePermissionsUpdateData = InferInput<typeof RolePermissionsUpdateSchema>;

