/**
 * profile.mutations.ts — TanStack Mutation Hooks for Profile module
 */
import { createMutation, useQueryClient } from '@tanstack/solid-query';
import { broadcast, BroadcastEvents } from '@shared/store/broadcast.store';
import { actions as authActions } from '@modules/auth/store/auth.store';
import { profileKeys } from './profile.keys';
import { profileApi } from './profile.api';

export function useUpdateProfile() {
    const queryClient = useQueryClient();

    return createMutation(() => ({
        mutationFn: (body: { username?: string; email?: string }) =>
            profileApi.updateProfile(body),
        onSuccess: (_data: unknown, variables: { username?: string; email?: string }) => {
            queryClient.invalidateQueries({ queryKey: profileKeys.me() });
            authActions.updateUser(variables);
        },
    }));
}

export function useChangePassword() {
    return createMutation(() => ({
        mutationFn: (body: { currentPassword: string; newPassword: string }) =>
            profileApi.changePassword(body),
    }));
}

export function useRevokeMySession() {
    const queryClient = useQueryClient();

    return createMutation(() => ({
        mutationFn: (sessionId: string) =>
            profileApi.revokeMySession(sessionId),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: profileKeys.sessions() });
            broadcast.emit(BroadcastEvents.SESSIONS_REFRESH);
        },
    }));
}
