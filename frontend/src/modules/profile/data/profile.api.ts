// Profile API - TanStack Query Hooks
import { createQuery, createMutation } from '@tanstack/solid-query';
import { request } from '@shared/lib/http';
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
        queryFn: async () => {
            return request<Profile>('/auth/me');
        },
        staleTime: 5 * 60 * 1000, // 5 minutes
    }));
}

// Update profile (username/email)
export function useUpdateProfile() {
    return createMutation(() => ({
        mutationFn: async (data: UpdateProfileRequest) => {
            return request<UpdateProfileResponse>('/auth/profile', {
                method: 'PUT',
                body: JSON.stringify(data),
            });
        },
    }));
}

// Change password
export function useChangePassword() {
    return createMutation(() => ({
        mutationFn: async (data: ChangePasswordRequest) => {
            return request<ChangePasswordResponse>('/auth/change-password', {
                method: 'POST',
                body: JSON.stringify(data),
            });
        },
    }));
}
