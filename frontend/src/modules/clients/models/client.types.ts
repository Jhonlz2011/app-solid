// Client types - UI constants and type definitions
import type { ClientBody, ClientFilters } from '../data/clients.api';
import { clientsApi } from '../data/clients.api';
import type { TaxIdType, PersonType, TaxRegimeType } from '@app/schema/frontend';

// Infer Client type from API response (single item with relations)
export type Client = Awaited<ReturnType<typeof clientsApi.get>>;
// List response type
export type ClientsResponse = Awaited<ReturnType<typeof clientsApi.list>>;

// Re-export for convenience
export type { ClientBody as ClientPayload, ClientFilters };
export type { TaxIdType, PersonType, TaxRegimeType };
export type { ContactFormData, AddressFormData } from '@app/schema/frontend';

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

// Re-export shared labels for backward compatibility
export { isActiveLabels } from '@shared/constants/labels';