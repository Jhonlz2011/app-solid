// Users/RBAC types inferred from Eden
import { usersApi } from '../data/users.api';

// Infer types from Eden API responses
export type Role = Awaited<ReturnType<typeof usersApi.listRoles>>[number];
export type Permission = Awaited<ReturnType<typeof usersApi.listPermissions>>['all'][number];
export type PermissionsResponse = Awaited<ReturnType<typeof usersApi.listPermissions>>;
export type UserWithRoles = Awaited<ReturnType<typeof usersApi.listUsersWithRoles>>[number];
export type RoleUsers = Awaited<ReturnType<typeof usersApi.getRoleUsers>>;