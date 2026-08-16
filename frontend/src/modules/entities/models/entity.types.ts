/**
 * entity.types.ts — Single source of truth for UI types, filter contracts, and label mappings
 * across all entity modules (Clients, Suppliers, Employees, Carriers).
 */
import {
    taxIdTypeLabels as baseTaxIdTypeLabels,
    personTypeLabels as basePersonTypeLabels,
    taxRegimeTypeLabels as baseTaxRegimeTypeLabels,
} from '@shared/forms/entity';

export type {
    EntityFilters,
    EntityReferences,
    EntityPickerItem,
    EntityDetailDto,
    EntityPayload,
} from '@app/schema/dto';

export const taxIdTypeLabels: Record<string, string> = {
    ...baseTaxIdTypeLabels,
    IDENTIFICACION_DEL_EXTERIOR: 'Identificación Exterior',
    VENTA_A_CONSUMIDOR_FINAL: 'Consumidor Final',
};

export const personTypeLabels: Record<string, string> = {
    ...basePersonTypeLabels,
};

export const taxRegimeTypeLabels: Record<string, string> = {
    ...baseTaxRegimeTypeLabels,
    ESPECIAL: 'Contribuyente Especial',
};

export const getTaxIdTypeLabel = (type: string | null | undefined): string => {
    if (!type) return 'RUC';
    return taxIdTypeLabels[type] || type;
};

export const getPersonTypeLabel = (type: string | null | undefined): string => {
    if (!type) return 'Persona Natural';
    return personTypeLabels[type] || type;
};

export const getTaxRegimeTypeLabel = (type: string | null | undefined): string => {
    if (!type) return 'No especificado';
    return taxRegimeTypeLabels[type] || type;
};
