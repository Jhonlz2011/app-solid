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

export type {
    EntityFilters,
    EntityReferences,
    EntityPickerItem,
    EntityDetailDto,
    EntityPayload,
} from '@app/schema/dto';

export const taxIdTypeLabels = taxIdTypeDisplayLabels;
export { personTypeLabels };
export const taxRegimeTypeLabels = taxRegimeTypeDisplayLabels;

export const getTaxIdTypeLabel = (type: string | null | undefined): string => {
    return getLabelOrFallback(taxIdTypeLabels, type, 'RUC');
};

export const getPersonTypeLabel = (type: string | null | undefined): string => {
    return getLabelOrFallback(personTypeLabels, type, 'Persona Natural');
};

export const getTaxRegimeTypeLabel = (type: string | null | undefined): string => {
    return getLabelOrFallback(taxRegimeTypeLabels, type, 'No especificado');
};

