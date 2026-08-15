import type { EntityFilters } from '@app/schema/dto';

export type EmployeeFilters = EntityFilters;

export const taxIdTypeLabels = {
    RUC: 'RUC',
    CEDULA: 'Cédula',
    PASAPORTE: 'Pasaporte',
    IDENTIFICACION_EXTERIOR: 'Identificación del Exterior',
};

export const personTypeLabels = {
    NATURAL: 'Natural',
    JURIDICA: 'Jurídica',
};

export const taxRegimeTypeLabels = {
    GENERAL: 'General',
    RIMPE_EMPRENDEDOR: 'RIMPE Emprendedor',
    RIMPE_NEGOCIO_POPULAR: 'RIMPE Negocio Popular',
};
