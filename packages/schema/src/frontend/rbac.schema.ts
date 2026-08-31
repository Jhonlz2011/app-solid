import { pipe, string, minLength, email, object, boolean, array, number, optional, nullable, union, literal, type InferInput } from 'valibot';

export const UserCreateSchema = object({
    email: pipe(string(), email('Correo electrónico inválido')),
    roleIds: pipe(array(number()), minLength(1, 'Debes asignar al menos un rol al usuario')),
    entityId: optional(nullable(string())),
    username: optional(union([pipe(string(), minLength(3, 'El usuario debe tener al menos 3 caracteres')), literal('')])),
    password: optional(union([pipe(string(), minLength(8, 'La contraseña debe tener al menos 8 caracteres')), literal('')])),
    mode: optional(union([literal('invite'), literal('direct')])),
    sendEmail: optional(boolean()),
});
export type UserCreateData = InferInput<typeof UserCreateSchema>;

// --- ACCEPT INVITATION SCHEMA ---
export const AcceptInvitationSchema = object({
    token: pipe(string(), minLength(10, 'Token de invitación inválido')),
    email: pipe(string(), email('Correo electrónico inválido')),
    password: pipe(string(), minLength(8, 'La contraseña debe tener al menos 8 caracteres')),
    confirmPassword: pipe(string(), minLength(8, 'Confirma tu contraseña')),
});
export type AcceptInvitationData = InferInput<typeof AcceptInvitationSchema>;

// --- USER UPDATE SCHEMA (Admin edit) ---
/** Strict schema for user editing — isActive toggle, roleIds, entityId scoped to tenant */
export const UserUpdateSchema = object({
    isActive: boolean(),
    roleIds: pipe(array(number()), minLength(1, 'El usuario debe tener al menos un rol asignado')),
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

