/**
 * Centralized password hashing and verification service using Argon2id.
 * 
 * Consistent security parameters across:
 * - Better-Auth credential plugin
 * - Tenant onboarding (auth.service.ts)
 * - Administrative user creation (rbac.users.service.ts)
 * - Administrative password reset (rbac.users.service.ts)
 */

export const ARGON2_CONFIG = {
    algorithm: 'argon2id' as const,
    memoryCost: 65536,
    timeCost: 2,
};

/**
 * Hashes a plaintext password using Argon2id with standardized memory and time costs.
 */
export async function hashPassword(password: string): Promise<string> {
    return Bun.password.hash(password, ARGON2_CONFIG);
}

/**
 * Verifies a plaintext password against an Argon2id or legacy hash.
 */
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
    if (!hash || !password) return false;
    try {
        // Native Argon2 ($argon2...)
        if (hash.startsWith('$')) {
            return await Bun.password.verify(password, hash);
        }
        // Legacy Better-Auth (hash:salt)
        if (hash.includes(':')) {
            const { verifyPassword: betterAuthVerify } = await import('better-auth/crypto').catch(() => ({ verifyPassword: null }));
            if (betterAuthVerify) {
                return await betterAuthVerify({ hash, password });
            }
        }
        return await Bun.password.verify(password, hash);
    } catch {
        return false;
    }
}
