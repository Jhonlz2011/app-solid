import { pipe, string, trim, minLength, minValue, object, picklist, boolean, number, array, optional, nullable, type InferInput } from 'valibot';
import { REQUEST_DESTINATIONS, CONDITIONS } from '../enums';

// ============================================================================
// TOOL CRIB & EQUIPMENT CUSTODY SCHEMAS (Valibot - Frontend)
// ============================================================================

export const ToolLoanItemFormSchema = object({
    variantId: number(),
    toolItemId: optional(nullable(number())),
    quantityLoaned: pipe(number(), minValue(0.0001, 'La cantidad debe ser mayor a 0')),
    notes: optional(nullable(string())),
});

export const ToolLoanFormSchema = object({
    borrowerId: pipe(string(), minLength(1, 'El custodio (empleado) es requerido')),
    dispatchedBy: optional(nullable(string())),
    workOrderId: optional(nullable(number())),
    destinationType: picklist(REQUEST_DESTINATIONS, 'Destino requerido'),
    locationDetail: optional(nullable(string())),
    expectedReturnDate: pipe(string(), minLength(1, 'La fecha estimada de devolución es requerida')),
    notes: optional(nullable(string())),
    items: pipe(array(ToolLoanItemFormSchema), minLength(1, 'Debe agregar al menos una herramienta')),
});

export const ToolReturnItemFormSchema = object({
    loanItemId: number(),
    quantityReturned: pipe(number(), minValue(0.0001, 'La cantidad debe ser mayor a 0')),
    condition: picklist(CONDITIONS, 'Condición requerida'),
    damageNotes: optional(nullable(string())),
    requiresMaintenance: boolean(),
});

export const ToolReturnFormSchema = object({
    receivedBy: optional(nullable(string())),
    notes: optional(nullable(string())),
    items: pipe(array(ToolReturnItemFormSchema), minLength(1, 'Debe registrar al menos un ítem devuelto')),
});

export type ToolLoanItemFormData = InferInput<typeof ToolLoanItemFormSchema>;
export type ToolLoanFormData = InferInput<typeof ToolLoanFormSchema>;
export type ToolReturnItemFormData = InferInput<typeof ToolReturnItemFormSchema>;
export type ToolReturnFormData = InferInput<typeof ToolReturnFormSchema>;
