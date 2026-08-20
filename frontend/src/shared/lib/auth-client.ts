import { createAuthClient } from 'better-auth/solid';
import { organizationClient, usernameClient, twoFactorClient } from 'better-auth/client/plugins';

// En producción VITE_API_URL siempre debe estar definida.
// El fallback a https://api.zelys.app es el dominio canónico de producción.
// Para desarrollo local, definir VITE_API_URL=http://localhost:3000 en .env.local
const baseURL = import.meta.env.VITE_API_URL || 'https://api.zelys.app';

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
