import { Type, type Static } from './typebox';
import type { ToolLoanStatus, ToolItemStatus, Condition, RequestDestination } from '../enums';

// ============================================================================
// TOOL CRIB & EQUIPMENT CUSTODY DTOs (TypeBox)
// ============================================================================

export const ToolLoanItemBodySchema = Type.Object({
    variantId: Type.Number(),
    toolItemId: Type.Optional(Type.Union([Type.Number(), Type.Null()])),
    quantityLoaned: Type.Number({ minimum: 0.0001 }),
    notes: Type.Optional(Type.Union([Type.String(), Type.Null()])),
});

export const ToolLoanBodySchema = Type.Object({
    borrowerId: Type.String(), // UUID of employee (entities.id)
    dispatchedBy: Type.Optional(Type.String()), // UUID of clerk (entities.id)
    workOrderId: Type.Optional(Type.Union([Type.Number(), Type.Null()])),
    destinationType: Type.Optional(Type.Union([Type.Literal('WORKSHOP'), Type.Literal('FIELD_SITE')])),
    locationDetail: Type.Optional(Type.Union([Type.String(), Type.Null()])),
    expectedReturnDate: Type.String(), // YYYY-MM-DD
    notes: Type.Optional(Type.Union([Type.String(), Type.Null()])),
    items: Type.Array(ToolLoanItemBodySchema, { minItems: 1 }),
});

export const ToolReturnItemBodySchema = Type.Object({
    loanItemId: Type.Number(),
    quantityReturned: Type.Number({ minimum: 0.0001 }),
    condition: Type.Optional(Type.Union([
        Type.Literal('GOOD'),
        Type.Literal('DAMAGED'),
        Type.Literal('UNUSABLE'),
    ])),
    damageNotes: Type.Optional(Type.Union([Type.String(), Type.Null()])),
    requiresMaintenance: Type.Optional(Type.Boolean()),
});

export const ToolReturnBodySchema = Type.Object({
    receivedBy: Type.Optional(Type.String()), // UUID of clerk (entities.id)
    notes: Type.Optional(Type.Union([Type.String(), Type.Null()])),
    items: Type.Array(ToolReturnItemBodySchema, { minItems: 1 }),
});

export const ToolLoanQuerySchema = Type.Object({
    borrowerId: Type.Optional(Type.String()),
    workOrderId: Type.Optional(Type.Union([Type.String(), Type.Number()])),
    status: Type.Optional(Type.String()),
    overdueOnly: Type.Optional(Type.Union([Type.String(), Type.Boolean()])),
    search: Type.Optional(Type.String()),
});

export type ToolLoanItemBodyType = Static<typeof ToolLoanItemBodySchema>;
export type ToolLoanBodyType = Static<typeof ToolLoanBodySchema>;
export type ToolReturnItemBodyType = Static<typeof ToolReturnItemBodySchema>;
export type ToolReturnBodyType = Static<typeof ToolReturnBodySchema>;
export type ToolLoanQueryType = Static<typeof ToolLoanQuerySchema>;

// Interfaces for Response Payloads
export interface ToolLoanItemDetail {
    id: number;
    loan_id: number;
    variant_id: number;
    tool_item_id: number | null;
    quantity_loaned: string | number;
    quantity_returned: string | number;
    pending_quantity: number;
    notes: string | null;
    variant_name?: string | null;
    sku?: string;
    product_name?: string;
    tool_item_code?: string | null;
}

export interface ToolLoanNode {
    id: number;
    company_id: number;
    code: string;
    borrower_id: string;
    borrower_name: string;
    dispatched_by: string;
    dispatched_by_name: string;
    work_order_id: number | null;
    destination_type: RequestDestination;
    location_detail: string | null;
    loan_date: string | Date;
    expected_return_date: string | Date;
    actual_return_date: string | Date | null;
    status: ToolLoanStatus;
    notes: string | null;
    items_count: number;
    pending_items_count: number;
    is_overdue: boolean;
    created_at: string | Date;
}

export interface ToolLoanDetail extends ToolLoanNode {
    items: ToolLoanItemDetail[];
    returns?: Array<{
        id: number;
        return_date: string | Date;
        received_by_name: string;
        notes: string | null;
        items: Array<{
            id: number;
            loan_item_id: number;
            quantity_returned: string | number;
            condition: Condition;
            damage_notes: string | null;
            requires_maintenance: boolean;
        }>;
    }>;
}

export interface EmployeeCustodySummary {
    employeeId: string;
    employeeName: string;
    activeLoansCount: number;
    totalToolsInCustody: number;
    overdueLoansCount: number;
    items: Array<{
        loanId: number;
        loanCode: string;
        loanDate: string | Date;
        expectedReturnDate: string | Date;
        isOverdue: boolean;
        variantId: number;
        variantName: string;
        sku: string;
        productName: string;
        quantityLoaned: number;
        quantityReturned: number;
        quantityPending: number;
    }>;
}
