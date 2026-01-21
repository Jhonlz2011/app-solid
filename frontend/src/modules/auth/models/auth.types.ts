export interface Entity {
    id: number;
    businessName: string;
    isClient: boolean;
    isSupplier: boolean;
    isEmployee: boolean;
}

export interface User {
    id: number;
    email: string;
    username?: string;
    roles?: string[];
    permissions?: string[];
    entity?: Entity | null;
}


export interface LoginRequest {
    email: string;
    password: string;
}

export interface LoginResponse {
    user: {
        id: number;
        email: string;
        roles: string[];
        permissions: string[];
    };
    accessToken: string;
}

export interface TokenResponse {
    accessToken: string;
}

export interface ApiError {
    error: string;
    message?: string;
}

export class AuthError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'AuthError';
    }
}

