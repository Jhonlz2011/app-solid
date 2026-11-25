import { pipe, email, string, minLength, maxLength, trim, object, boolean, array, number, optional, nullable, union, literal, forward, check, type InferInput } from 'valibot';
import { EmailFormatSchema, UsernameFormatSchema } from './auth.schema';

export const UserCreateSchema = pipe(
    object({
        email: EmailFormatSchema,
        roleIds: pipe(array(number()), minLength(1, 'Debes asignar al menos un rol al usuario')),
        entityId: optional(nullable(string())),
        username: optional(union([UsernameFormatSchema, literal('')])),
        mode: optional(union([literal('invite'), literal('direct')])),
        temporaryPassword: optional(union([
            pipe(
                string(),
                minLength(8, 'La contraseña temporal debe tener al menos 8 caracteres'),
                maxLength(128, 'La contraseña temporal no puede exceder 128 caracteres'),
            ),
            literal(''),
        ])),
        mustChangePassword: optional(boolean()),
        sendEmail: optional(boolean()),
    }),
    forward(
        check(
            (input) => input.mode !== 'direct' || (typeof input.temporaryPassword === 'string' && input.temporaryPassword.length >= 8),
            'Ingresa o genera una contraseña temporal de al menos 8 caracteres'
        ),
        ['temporaryPassword']
    )
);
export type UserCreateData = InferInput<typeof UserCreateSchema>;

// --- ACCEPT INVITATION SCHEMA ---
export const AcceptInvitationSchema = object({
    token: pipe(string(), minLength(10, 'Token de invitación inválido')),
    email: pipe(string(), email('Correo electrónico inválido')),
    password: pipe(
        string(),
        minLength(8, 'La contraseña debe tener al menos 8 caracteres'),
        maxLength(128, 'La contraseña no puede exceder 128 caracteres')
    ),
    confirmPassword: pipe(
        string(),
        minLength(8, 'Confirma tu contraseña'),
        maxLength(128, 'La contraseña no puede exceder 128 caracteres')
    ),
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
export const UserPasswordResetSchema = object({});
export type UserPasswordResetData = InferInput<typeof UserPasswordResetSchema>;

// --- ENTITY ASSIGNMENT ---
export const UserAssignEntitySchema = object({
    entityId: optional(nullable(string())),
});
export type UserAssignEntityData = InferInput<typeof UserAssignEntitySchema>;

// --- ROLE SCHEMAS ---
export const RoleCreateSchema = object({
    name: pipe(string(), trim(), minLength(2, 'El nombre del rol debe tener al menos 2 caracteres')),
    description: optional(nullable(string())),
    permissionSlugs: optional(array(string())),
});

export type RoleCreateData = InferInput<typeof RoleCreateSchema>;

export const RoleUpdateSchema = object({
    name: pipe(string(), trim(), minLength(2, 'El nombre del rol debe tener al menos 2 caracteres')),
    description: optional(nullable(string())),
    permissionSlugs: optional(array(string())),
});
export type RoleUpdateData = InferInput<typeof RoleUpdateSchema>;

export const RolePermissionsUpdateSchema = object({
    permissionSlugs: array(string()),
});
export type RolePermissionsUpdateData = InferInput<typeof RolePermissionsUpdateSchema>;

