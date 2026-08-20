// ============================================================================
// AUTH & TENANT DTOs — Pure TypeScript Contracts
// ============================================================================

export interface AuthRegisterPayload {
    fullName: string;
    username: string;
    email: string;
    password: string;
    phone?: string;
    cedula?: string;
    slug: string;
    ruc: string;
    businessName: string;
    tradeName?: string;
    businessType?: string;
    mainAddress?: string;
    obligadoContabilidad?: boolean;
    contribuyenteEspecial?: string;
    taxRegime?: string;
    turnstileToken?: string;
}


export interface AuthUpdateProfilePayload {
    username?: string;
    email?: string;
}

export interface AuthUserEntityDto {
    id: number;
    businessName: string;
    isClient: boolean;
    isSupplier: boolean;
    isEmployee: boolean;
}

export interface AuthUserResponseDto {
    id: string | number;
    companyId: number;
    username: string;
    email: string;
    isActive: boolean | null;
    lastLogin: Date | null;
    entityId: number | null;
    emailVerified?: boolean;
    companySlug: string;
    roles: string[];
    permissions: string[];
    entity?: AuthUserEntityDto;
}

export interface DiscoverTenantItemDto {
    id: number;
    organizationId: string;  // Better-Auth organization.id (UUIDv7) — requerido para setActive
    slug: string;
    businessName: string;
    tradeName: string | null;
    logoUrl: string | null;
}

export interface TenantBrandingDto {
    id: number;
    slug: string;
    businessName: string;
    tradeName: string | null;
    logoUrl: string | null;
    primaryColor: string;
    themeColor: string;
    loginBgUrl: string | null;
}
