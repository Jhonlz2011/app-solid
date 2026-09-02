import { createAuthClient } from 'better-auth/solid';
import { organizationClient, usernameClient, twoFactorClient } from 'better-auth/client/plugins';
import { getApiUrl } from '../config/runtime-env';

const baseURL = getApiUrl();

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
