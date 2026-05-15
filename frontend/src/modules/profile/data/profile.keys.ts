/**
 * profile.keys.ts — Centralized query keys for Profile/Auth module
 */
export const profileKeys = {
    all: ['profile'] as const,
    me: () => [...profileKeys.all, 'me'] as const,
    sessions: () => [...profileKeys.all, 'sessions'] as const,
};
