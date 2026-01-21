/**
 * Generates a consistent gradient color pair based on a string (like username).
 * Uses a simple hash algorithm to always produce the same colors for the same input.
 */

// Predefined gradient pairs that look good together
const GRADIENT_PAIRS = [
    { from: '#8B5CF6', to: '#EC4899' }, // Purple to Pink
    { from: '#06B6D4', to: '#3B82F6' }, // Cyan to Blue
    { from: '#10B981', to: '#14B8A6' }, // Emerald to Teal
    { from: '#F59E0B', to: '#EF4444' }, // Amber to Red
    { from: '#6366F1', to: '#8B5CF6' }, // Indigo to Purple
    { from: '#EC4899', to: '#F43F5E' }, // Pink to Rose
    { from: '#3B82F6', to: '#6366F1' }, // Blue to Indigo
    { from: '#14B8A6', to: '#06B6D4' }, // Teal to Cyan
    { from: '#F43F5E', to: '#F59E0B' }, // Rose to Amber
    { from: '#84CC16', to: '#10B981' }, // Lime to Emerald
];

/**
 * Simple hash function that converts a string to a number
 */
function hashString(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash);
}

/**
 * Get a gradient pair based on a string input
 * Always returns the same gradient for the same input
 */
export function getAvatarGradient(input: string): { from: string; to: string } {
    const hash = hashString(input.toLowerCase().trim());
    const index = hash % GRADIENT_PAIRS.length;
    return GRADIENT_PAIRS[index];
}

/**
 * Get CSS style object for the gradient
 */
export function getAvatarGradientStyle(input: string): { background: string } {
    const { from, to } = getAvatarGradient(input);
    return {
        background: `linear-gradient(to bottom right, ${from}, ${to})`
    };
}

/**
 * Get initials from a name (up to 2 characters)
 */
export function getInitials(name: string): string {
    if (!name) return '??';

    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) {
        // First letter of first and last name
        return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    // Just first two letters of single name
    return name.slice(0, 2).toUpperCase();
}
