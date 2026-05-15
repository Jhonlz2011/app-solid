/**
 * profile.queries.ts — TanStack Query Hooks (read-only) for Profile module
 */
import { createQuery } from '@tanstack/solid-query';
import { profileKeys } from './profile.keys';
import { profileApi } from './profile.api';

export function useProfile() {
    return createQuery(() => ({
        queryKey: profileKeys.me(),
        queryFn: () => profileApi.getMe(),
        staleTime: 1000 * 60 * 5,
        gcTime: 1000 * 60 * 30,
    }));
}

export function useMySessions() {
    return createQuery(() => ({
        queryKey: profileKeys.sessions(),
        queryFn: () => profileApi.getMySessions(),
        staleTime: 1000 * 60,
        gcTime: 1000 * 60 * 5,
        refetchOnMount: false,
        refetchOnWindowFocus: false,
    }));
}
