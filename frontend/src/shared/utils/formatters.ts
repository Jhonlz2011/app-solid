/**
 * formatters.ts — Shared formatters for currency, dates, numbers, and percentages.
 * Standardized for Ecuador (USD, es-EC).
 */

const currencyFormatter = new Intl.NumberFormat('es-EC', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
});

const numberFormatter = new Intl.NumberFormat('es-EC', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
});

/**
 * Format a number or numeric string as USD currency ($1,234.56).
 */
export function formatCurrency(value: number | string | null | undefined): string {
    if (value === null || value === undefined || value === '') return '$0.00';
    const num = typeof value === 'string' ? parseFloat(value) : value;
    if (isNaN(num)) return '$0.00';
    return currencyFormatter.format(num);
}

/**
 * Format a date as human-readable standard date (e.g., "15 ago 2026").
 */
export function formatDate(value: string | Date | null | undefined): string {
    if (!value) return 'No registrada';
    const d = typeof value === 'string' ? new Date(value) : value;
    if (isNaN(d.getTime())) return 'Fecha inválida';
    return d.toLocaleDateString('es-EC', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
    });
}

/**
 * Format a date with time (e.g., "15 ago 2026, 18:30").
 */
export function formatDateTime(value: string | Date | null | undefined): string {
    if (!value) return 'No registrada';
    const d = typeof value === 'string' ? new Date(value) : value;
    if (isNaN(d.getTime())) return 'Fecha inválida';
    return d.toLocaleDateString('es-EC', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    });
}

/**
 * Format a number with thousands separators.
 */
export function formatNumber(value: number | string | null | undefined, decimals = 2): string {
    if (value === null || value === undefined || value === '') return '0.00';
    const num = typeof value === 'string' ? parseFloat(value) : value;
    if (isNaN(num)) return '0.00';
    if (decimals === 2) return numberFormatter.format(num);
    return new Intl.NumberFormat('es-EC', {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
    }).format(num);
}

/**
 * Format percentage (e.g., 15 -> "15%").
 */
export function formatPercent(value: number | string | null | undefined): string {
    if (value === null || value === undefined || value === '') return '0%';
    const num = typeof value === 'string' ? parseFloat(value) : value;
    if (isNaN(num)) return '0%';
    return `${num}%`;
}
