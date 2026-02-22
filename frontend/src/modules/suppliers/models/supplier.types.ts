// Supplier types - UI constants and type definitions
import type { SupplierBody, SupplierFilters } from '../data/suppliers.api';
import { suppliersApi } from '../data/suppliers.api';
import type { TaxIdType, PersonType, SriContributorType } from '@app/schema/frontend';

// Infer Supplier type from API response (single item with relations)
export type Supplier = Awaited<ReturnType<typeof suppliersApi.get>>;
// List response type
export type SuppliersResponse = Awaited<ReturnType<typeof suppliersApi.list>>;

// Re-export for convenience
export type { SupplierBody as SupplierPayload, SupplierFilters };
export type { TaxIdType, PersonType, SriContributorType };

// UI Label mappings
export const taxIdTypeLabels: Record<TaxIdType, string> = {
    RUC: 'RUC',
    CEDULA: 'Cédula',
    PASAPORTE: 'Pasaporte',
};

export const personTypeLabels: Record<PersonType, string> = {
    NATURAL: 'Persona Natural',
    JURIDICA: 'Persona Jurídica',
};

export const sriContributorLabels: Record<SriContributorType, string> = {
    RIMPE_POPULAR: 'RIMPE Popular',
    RIMPE_EMPRENDEDOR: 'RIMPE Emprendedor',
    GENERAL: 'Régimen General',
    ESP_AGENT: 'Agente de Retención',
};

export const isActiveLabels: Record<string, string> = {
    'true': 'Activo',
    'false': 'Inactivo',
};
