import { pipe, string, trim, minLength, maxLength, object, picklist, boolean, number, optional, nullable, union, type InferInput } from 'valibot';
import { LOCATION_TYPES, UOM_GROUPS } from '../enums';

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

// --- UNITS OF MEASURE ---
export const UomFormSchema = object({
    code: pipe(string(), trim(), minLength(1, 'El código es requerido'), maxLength(10, 'Máx 10 caracteres')),
    name: pipe(string(), trim(), minLength(1, 'El nombre es requerido')),
    uom_group: picklist(UOM_GROUPS, 'Grupo es requerido'),
    base_factor: optional(nullable(union([string(), number()]))),
});
export type UomFormData = InferInput<typeof UomFormSchema>;
