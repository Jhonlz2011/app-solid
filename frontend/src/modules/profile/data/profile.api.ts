// Profile API - TanStack Query Hooks (Using Eden)
import { createQuery, createMutation } from '@tanstack/solid-query';
import { api } from '@shared/lib/eden';
import type {
    Profile,
    UpdateProfileRequest,
    UpdateProfileResponse,
    ChangePasswordRequest,
    ChangePasswordResponse,
} from '../models/profile.types';

// Query Keys
export const profileKeys = {
    all: ['profile'] as const,
    me: () => [...profileKeys.all, 'me'] as const,
};

// Get current user profile
export function useProfile() {
    return createQuery(() => ({
        queryKey: profileKeys.me(),
        queryFn: async (): Promise<Profile> => {
            const { data, error } = await api.api.auth.me.get();
            if (error) throw new Error(String(error.value));
            // Map backend response to Profile type
            const d = data as any;
            return {
                id: d.id,
                email: d.email,
                username: d.username,
                entityId: d.entityId ?? d.entity_id ?? null,
                isActive: d.isActive ?? d.is_active ?? true,
                lastLogin: d.lastLogin ?? d.last_login ?? null,
                roles: d.roles ?? [],
                permissions: d.permissions ?? [],
                entity: d.entity ?? null,
            };
        },
        staleTime: 5 * 60 * 1000, // 5 minutes
    }));
}

// Update profile (username/email)
export function useUpdateProfile() {
    return createMutation(() => ({
        mutationFn: async (body: UpdateProfileRequest): Promise<UpdateProfileResponse> => {
            const { data, error } = await api.api.auth.profile.put(body);
            if (error) throw new Error(String(error.value));
            return data as UpdateProfileResponse;
        },
    }));
}

// Change password
export function useChangePassword() {
    return createMutation(() => ({
        mutationFn: async (body: ChangePasswordRequest): Promise<ChangePasswordResponse> => {
            const { data, error } = await api.api.auth["change-password"].post(body);
            if (error) throw new Error(String(error.value));
            return data as ChangePasswordResponse;
        },
    }));
}
