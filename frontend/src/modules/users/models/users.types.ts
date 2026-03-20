// Re-export all types from the unified data layer for backward compatibility
export type {
    Role,
    RoleListItem,
    UserWithRoles,
    UserListItem,
    Permission,
    PermissionsResponse,
    RoleUsers,
    UsersMeta,
    UsersFilters,
    RoleBody,
} from '../data/users.api';

export const isActiveLabels: Record<string, string> = {
    'true': 'Activo',
    'false': 'Inactivo',
};