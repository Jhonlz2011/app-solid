/**
 * Centralized entity label maps — Single source of truth.
 * Form labels are a strict enum-typed SUBSET of display labels.
 */
import type { TaxIdTypeForm, PersonType, TaxRegimeType } from '@app/schema/enums';

// ─── Form Labels (strict enum keys) ─────────────────────────────
export const taxIdTypeFormLabels: Record<TaxIdTypeForm, string> = {
    RUC: 'RUC',
    CEDULA: 'Cédula',
    PASAPORTE: 'Pasaporte',
    EXTERIOR: 'Exterior',
};

export const personTypeLabels: Record<PersonType, string> = {
    NATURAL: 'Persona Natural',
    JURIDICA: 'Persona Jurídica',
};

export const taxRegimeTypeLabels: Record<TaxRegimeType, string> = {
    RIMPE_NEGOCIO_POPULAR: 'RIMPE Popular',
    RIMPE_EMPRENDEDOR: 'RIMPE Emprendedor',
    GENERAL: 'Régimen General',
};

// ─── Display Labels (extended for table columns, includes SRI-only types) ────
export const taxIdTypeDisplayLabels: Record<string, string> = {
    ...taxIdTypeFormLabels,
    CONSUMIDOR_FINAL: 'Consumidor Final',
    IDENTIFICACION_DEL_EXTERIOR: 'Identificación Exterior',
    VENTA_A_CONSUMIDOR_FINAL: 'Consumidor Final',
};

export const taxRegimeTypeDisplayLabels: Record<string, string> = {
    ...taxRegimeTypeLabels,
    ESPECIAL: 'Contribuyente Especial',
};

export const roleLabels = {
    isClient: 'Cliente',
    isSupplier: 'Proveedor',
    isEmployee: 'Empleado',
    isCarrier: 'Transportista',
} as const;

export const getLabelOrFallback = (
    labels: Record<string, string>,
    key: string | null | undefined,
    fallback: string
): string => {
    if (!key) return fallback;
    return labels[key] || key;
};
