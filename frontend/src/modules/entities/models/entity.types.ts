/**
 * entity.types.ts — Single source of truth for UI types, filter contracts, and label mappings
 * across all entity modules (Clients, Suppliers, Employees, Carriers).
 */
import {
    taxIdTypeDisplayLabels,
    personTypeLabels,
    taxRegimeTypeDisplayLabels,
    getLabelOrFallback,
} from '@shared/constants/entity-labels';

export const getTaxIdTypeLabel = (type: string | null | undefined): string => {
    return getLabelOrFallback(taxIdTypeDisplayLabels, type, 'RUC');
};

export const getPersonTypeLabel = (type: string | null | undefined): string => {
    return getLabelOrFallback(personTypeLabels, type, 'Persona Natural');
};

export const getTaxRegimeTypeLabel = (type: string | null | undefined): string => {
    return getLabelOrFallback(taxRegimeTypeDisplayLabels, type, 'No especificado');
};

