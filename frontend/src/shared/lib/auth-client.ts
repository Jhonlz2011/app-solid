import { createAuthClient } from 'better-auth/solid';
import { organizationClient, usernameClient, twoFactorClient } from 'better-auth/client/plugins';

const baseURL = import.meta.env.VITE_API_URL || (typeof window !== 'undefined' ? `${window.location.protocol}//${window.location.hostname}:3000` : 'http://localhost:3000');

export const authClient = createAuthClient({
    baseURL: baseURL,
    plugins: [
        usernameClient(),
        organizationClient(),
        twoFactorClient(),
    ],
    fetchOptions: {
        credentials: 'include',
    },
});

export type AuthClient = typeof authClient;
