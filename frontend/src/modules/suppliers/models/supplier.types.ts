// Supplier types - UI constants and type definitions
import type { TaxIdType, PersonType, TaxRegimeType } from '@app/schema/frontend';

// UI Label mappings (We omit CONSUMIDOR_FINAL intentionally for the Form UI)
export const taxIdTypeLabels: Partial<Record<TaxIdType, string>> = {
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

// shared labels for backward compatibility
export { isActiveLabels } from '@shared/constants/labels';