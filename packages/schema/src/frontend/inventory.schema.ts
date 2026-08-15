import { pipe, string, trim, minLength, maxLength, object, picklist, boolean, number, optional, nullable, type InferInput } from 'valibot';
import { LOCATION_TYPES } from '../enums';

// --- WAREHOUSES & LOCATIONS ---
export const WarehouseFormSchema = object({
    code: pipe(string(), trim(), minLength(1, 'El código es requerido'), maxLength(20, 'Máx 20 caracteres')),
    name: pipe(string(), trim(), minLength(1, 'El nombre es requerido'), maxLength(100, 'Máx 100 caracteres')),
    address: optional(nullable(string())),
    is_mobile: boolean(),
});
export type WarehouseFormData = InferInput<typeof WarehouseFormSchema>;

export const LocationFormSchema = object({
    name: pipe(string(), trim(), minLength(1, 'El nombre es requerido'), maxLength(100, 'Máx 100 caracteres')),
    parent_id: optional(nullable(number())),
    warehouse_id: optional(nullable(number())),
    type: picklist(LOCATION_TYPES, 'Tipo requerido'),
});
export type LocationFormData = InferInput<typeof LocationFormSchema>;
