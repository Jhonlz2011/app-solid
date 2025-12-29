export interface Role {
    id: number;
    name: string;
    description: string | null;
    userCount: number;
}

export interface Permission {
    id: number;
    slug: string;
    description: string | null;
}

export interface PermissionsResponse {
    all: Permission[];
    grouped: Record<string, Permission[]>;
}

export interface UserWithRoles {
    id: number;
    username: string;
    email: string;
    isActive: boolean | null;
    lastLogin: Date | null;
    roles: { id: number; name: string }[];
}