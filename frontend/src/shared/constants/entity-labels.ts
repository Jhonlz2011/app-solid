/**
 * Centralized entity label maps — Single source of truth.
 * Form labels are a strict enum-typed SUBSET of display labels.
 */
import type { TaxIdTypeForm, PersonType, TaxRegimeType, ContractType, BankAccountType } from '@app/schema/enums';

// ─── Form Labels (strict enum keys) ─────────────────────────────
export const taxIdTypeFormLabels: Record<TaxIdTypeForm, string> = {
    RUC: 'RUC',
    CEDULA: 'Cédula',
    PASAPORTE: 'Pasaporte',
    EXTERIOR: 'Exterior',
};

export const personTypeLabels: Record<PersonType, string> = {
    NATURAL: 'Natural',
    JURIDICA: 'Jurídica',
};

export const taxRegimeTypeLabels: Record<TaxRegimeType, string> = {
    RIMPE_NEGOCIO_POPULAR: 'RIMPE Popular',
    RIMPE_EMPRENDEDOR: 'RIMPE Emprendedor',
    GENERAL: 'Régimen General',
};

export const contractTypeLabels: Record<ContractType, string> = {
    INDEFINIDO: 'Contrato Indefinido',
    EVENTUAL: 'Eventual / Temporal',
    PLAZO_FIJO: 'Plazo Fijo',
    OBRA_CIERTA: 'Por Obra Cierta',
    PASANTIA: 'Pasantía / Prácticas',
    SERVICIOS_PROFESIONALES: 'Servicios Profesionales / Factura',
};

export const bankAccountTypeLabels: Record<BankAccountType, string> = {
    AHORROS: 'Cuenta de Ahorros',
    CORRIENTE: 'Cuenta Corriente',
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
