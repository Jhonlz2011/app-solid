const HEX_STRICT = /^[0-9a-fA-F]{6}$|^[0-9a-fA-F]{8}$/;

export function isHexColor(color: string): boolean {
    return /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/.test(color.trim());
}

export function getContrastColor(hex: string): string {
    let cleanHex = hex.trim().replace(/^#/, '');

    if (cleanHex.length === 3 || cleanHex.length === 4) {
        cleanHex = cleanHex.split('').map(char => char + char).join('');
    }

    // Validación estricta: longitud Y que todos los caracteres sean hex válidos
    if (!HEX_STRICT.test(cleanHex)) {
        return '#ffffff'; // Fallback seguro
    }

    const r = parseInt(cleanHex.substring(0, 2), 16);
    const g = parseInt(cleanHex.substring(2, 4), 16);
    const b = parseInt(cleanHex.substring(4, 6), 16);

    const toLinear = (c: number) => {
        const s = c / 255;
        return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
    };

    const l = 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);

    return l > 0.185 ? '#0f172a' : '#ffffff';
}