/**
 * Isomorphic color utilities — shared between frontend (branding.store) and backend (spa-renderer).
 * WCAG 2.0 compliant contrast color calculation.
 */

/** Validates a hex color string (#RGB, #RRGGBB, #RRGGBBAA). */
export function isHexColor(color: string): boolean {
    return /^#[0-9a-fA-F]{3,8}$/.test(color);
}

/**
 * Returns a readable text color (#0f172a or #ffffff) for a given background hex color.
 * Uses WCAG 2.0 relative luminance formula.
 */
export function getContrastColor(hex: string): string {
    // 1. Clean the string removing spaces and '#'
    let cleanHex = hex.replace('#', '').trim();

    // 2. Expand short formats like 'FFF' or 'FFFA' to 'FFFFFF' or 'FFFFFFAA'
    if (cleanHex.length === 3 || cleanHex.length === 4) {
        cleanHex = cleanHex.split('').map(char => char + char).join('');
    }

    // 3. Validate correct length (6 chars or 8 with alpha channel)
    if (cleanHex.length !== 6 && cleanHex.length !== 8) {
        return '#ffffff'; // Safe fallback
    }

    // 4. Extract R, G, B channels (ignoring alpha if present)
    const r = parseInt(cleanHex.substring(0, 2), 16);
    const g = parseInt(cleanHex.substring(2, 4), 16);
    const b = parseInt(cleanHex.substring(4, 6), 16);

    // Validate parsed values
    if (isNaN(r) || isNaN(g) || isNaN(b)) {
        return '#ffffff';
    }

    // 5. Convert to linear values per WCAG 2.0
    const toLinear = (c: number) => {
        const s = c / 255;
        return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
    };

    const l = 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);

    // 6. Return dark for light backgrounds and white for dark backgrounds
    // Threshold 0.179 is the standard based on sqrt(0.05 * 1.05)
    return l > 0.179 ? '#0f172a' : '#ffffff';
}
