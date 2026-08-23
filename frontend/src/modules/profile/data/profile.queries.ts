/**
 * profile.queries.ts — TanStack Query Hooks (read-only) for Profile module
 */
import { createQuery } from '@tanstack/solid-query';
import { STALE_TIME, GC_TIME } from '@shared/constants/cache.constants';
import { profileKeys } from './profile.keys';
import { profileApi } from './profile.api';

export function useProfile() {
    return createQuery(() => ({
        queryKey: profileKeys.me(),
        queryFn: () => profileApi.getMe(),
        staleTime: STALE_TIME.MEDIUM,
        gcTime: GC_TIME.DEFAULT,
    }));
}

export function useMySessions() {
    return createQuery(() => ({
        queryKey: profileKeys.sessions(),
        queryFn: () => profileApi.getMySessions(),
        staleTime: 60_000,
        gcTime: STALE_TIME.MEDIUM,
        refetchOnMount: false,
        refetchOnWindowFocus: false,
    }));
}
