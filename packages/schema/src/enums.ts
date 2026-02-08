import { pgEnum } from 'drizzle-orm/pg-core';

// ============================================================================
// ENUM VALUES - Single source of truth for all enum types
// ============================================================================

// Entity-related enums
export const TAX_ID_TYPES = ['RUC', 'CEDULA', 'PASAPORTE'] as const;
export const PERSON_TYPES = ['NATURAL', 'JURIDICA'] as const;
export const SRI_CONTRIBUTOR_TYPES = ['RIMPE_POPULAR', 'RIMPE_EMPRENDEDOR', 'GENERAL', 'ESP_AGENT'] as const;

// Document enums
export const QUOTATION_STATUSES = ['DRAFT', 'SENT', 'APPROVED', 'REJECTED', 'CONVERTED_TO_WO'] as const;
export const DOCUMENT_TYPES = ['INVOICE', 'CREDIT_NOTE', 'DEBIT_NOTE', 'REMISSION_GUIDE', 'PURCHASE_LIQUIDATION'] as const;
export const INVOICE_STATUSES = ['DRAFT', 'SIGNED', 'SENDING', 'AUTHORIZED', 'ANNULLED', 'REJECTED'] as const;

// Production enums
export const PRODUCTION_STATUSES = ['PLANNED', 'IN_CUTTING', 'ASSEMBLY', 'COMPLETED', 'CANCELLED'] as const;
export const REQUEST_DESTINATIONS = ['WORKSHOP', 'FIELD_SITE'] as const;
export const MATERIAL_REQUEST_STATUSES = ['PENDING', 'APPROVED', 'IN_TRANSIT', 'RECEIVED', 'COMPLETED'] as const;
export const WORK_ORDER_STATUSES = ['DRAFT', 'APPROVED', 'IN_PROGRESS', 'COMPLETED', 'INVOICED'] as const;

// Inventory enums
export const INVENTORY_STATUSES = ['AVAILABLE', 'RESERVED', 'SCRAP', 'CONSUMED'] as const;
export const CONDITIONS = ['GOOD', 'DAMAGED', 'UNUSABLE'] as const;

// Other enums
export const RETENTION_TYPES = ['IVA', 'RENTA', 'ISD'] as const;

// ============================================================================
// TYPESCRIPT TYPES - Derived from const arrays
// ============================================================================

export type TaxIdType = typeof TAX_ID_TYPES[number];
export type PersonType = typeof PERSON_TYPES[number];
export type SriContributorType = typeof SRI_CONTRIBUTOR_TYPES[number];
export type QuotationStatus = typeof QUOTATION_STATUSES[number];
export type DocumentType = typeof DOCUMENT_TYPES[number];
export type InvoiceStatus = typeof INVOICE_STATUSES[number];
export type ProductionStatus = typeof PRODUCTION_STATUSES[number];
export type RequestDestination = typeof REQUEST_DESTINATIONS[number];
export type MaterialRequestStatus = typeof MATERIAL_REQUEST_STATUSES[number];
export type WorkOrderStatus = typeof WORK_ORDER_STATUSES[number];
export type InventoryStatus = typeof INVENTORY_STATUSES[number];
export type Condition = typeof CONDITIONS[number];
export type RetentionType = typeof RETENTION_TYPES[number];

// ============================================================================
// PG ENUMS - For Drizzle schema definitions
// ============================================================================

export const taxIdTypeEnum = pgEnum('tax_id_type', TAX_ID_TYPES);
export const personTypeEnum = pgEnum('person_type', PERSON_TYPES);
export const sriContributorTypeEnum = pgEnum('sri_contributor_type', SRI_CONTRIBUTOR_TYPES);
export const quotationStatusEnum = pgEnum('quotation_status', QUOTATION_STATUSES);
export const documentTypeEnum = pgEnum('document_type', DOCUMENT_TYPES);
export const invoiceStatusEnum = pgEnum('invoice_status', INVOICE_STATUSES);
export const productionStatusEnum = pgEnum('production_status', PRODUCTION_STATUSES);
export const requestDestinationEnum = pgEnum('request_destination', REQUEST_DESTINATIONS);
export const materialRequestStatusEnum = pgEnum('material_request_status', MATERIAL_REQUEST_STATUSES);
export const workOrderStatusEnum = pgEnum('work_order_status', WORK_ORDER_STATUSES);
export const inventoryStatusEnum = pgEnum('inventory_status', INVENTORY_STATUSES);
export const conditionEnum = pgEnum('condition', CONDITIONS);
export const retentionTypeEnum = pgEnum('retention_type', RETENTION_TYPES);

// RESTRUCTURED: Product Type (main classification)
export const productTypeEnum = pgEnum('product_type', ['PRODUCTO', 'SERVICIO']);

// RESTRUCTURED: Product Subtype (only for PRODUCTO type)
export const productSubtypeEnum = pgEnum('product_subtype', ['SIMPLE', 'COMPUESTO', 'FABRICADO']);

export const movementTypeEnum = pgEnum('movement_type', ['PURCHASE', 'SALE', 'PRODUCTION_CONSUMPTION', 'PRODUCTION_OUTPUT', 'ADJUSTMENT', 'TRANSFER_OUT', 'TRANSFER_IN']);
export const paymentMethodSriEnum = pgEnum('payment_method_sri', ['01', '16', '19', '20']);
export const bomCalculationTypeEnum = pgEnum('bom_calculation_type', ['FIXED', 'AREA', 'PERIMETER', 'VOLUMEN']);
export const technicalVisitStatusEnum = pgEnum('technical_visit_status', ['SCHEDULED', 'COMPLETED', 'CANCELLED']);
export const justificationTypeEnum = pgEnum('justification_type', ['LIBRE', 'FALTA', 'IESS', 'VACACIONES', 'FERIADO', 'SAB', 'DOM']);

// NEW: Source of dimensional inventory items
export const dimensionalSourceEnum = pgEnum('dimensional_source', ['PURCHASE', 'CUT', 'RETURN', 'ADJUSTMENT', 'PRODUCTION']);

// NEW: Sale origin - POS direct sales vs Project/Work Order sales
export const saleOriginEnum = pgEnum('sale_origin', ['POS', 'PROJECT', 'ECOMMERCE']);

// NEW: POS session status
export const posSessionStatusEnum = pgEnum('pos_session_status', ['OPEN', 'CLOSED', 'RECONCILED']);
