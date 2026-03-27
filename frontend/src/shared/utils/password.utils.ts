/**
 * Generate a secure random password with mixed characters.
 * Excludes ambiguous chars (0, O, l, 1, I) for readability.
 */
export const generatePassword = (length = 16): string => {
    const chars = 'abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789!@#$%&*';
    return Array.from({ length }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
};
