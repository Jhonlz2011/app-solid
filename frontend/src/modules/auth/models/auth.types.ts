export interface User {
    id: number;
    email: string;
    username?: string;
    roles?: string[];
    permissions?: string[];
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

