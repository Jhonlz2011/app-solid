import { pgEnum } from 'drizzle-orm/pg-core';

// ============================================================================
// ENUM VALUES - Single source of truth for all enum types
// ============================================================================

// Entity-related enums
export const TAX_ID_TYPES = ['RUC', 'CEDULA', 'PASAPORTE', 'CONSUMIDOR_FINAL', 'EXTERIOR'] as const;
/** Form-only subset: excludes CONSUMIDOR_FINAL (seed-only DB record) */
export const TAX_ID_TYPES_FORM = ['RUC', 'CEDULA', 'PASAPORTE', 'EXTERIOR'] as const;
export type TaxIdTypeForm = typeof TAX_ID_TYPES_FORM[number];
export const PERSON_TYPES = ['NATURAL', 'JURIDICA'] as const;
export const TAX_REGIME_TYPES = ['RIMPE_NEGOCIO_POPULAR', 'RIMPE_EMPRENDEDOR', 'GENERAL'] as const;

// Document enums
export const QUOTATION_STATUSES = ['DRAFT', 'SENT', 'APPROVED', 'REJECTED', 'CONVERTED_TO_WO'] as const;
export const DOCUMENT_TYPES = ['INVOICE', 'CREDIT_NOTE', 'DEBIT_NOTE', 'REMISSION_GUIDE', 'PURCHASE_LIQUIDATION', 'WITHHOLDING'] as const;
export const INVOICE_STATUSES = ['DRAFT', 'SIGNED', 'SENDING', 'AUTHORIZED', 'ANNULLED', 'REJECTED'] as const;

// Production enums
export const PRODUCTION_STATUSES = ['PLANNED', 'IN_CUTTING', 'ASSEMBLY', 'COMPLETED', 'CANCELLED'] as const;
export const REQUEST_DESTINATIONS = ['WORKSHOP', 'FIELD_SITE'] as const;
export const MATERIAL_REQUEST_STATUSES = ['PENDING', 'APPROVED', 'IN_TRANSIT', 'RECEIVED', 'COMPLETED'] as const;
export const WORK_ORDER_STATUSES = ['DRAFT', 'APPROVED', 'IN_PROGRESS', 'COMPLETED', 'INVOICED'] as const;

// Inventory enums
export const CONDITIONS = ['GOOD', 'DAMAGED', 'UNUSABLE'] as const;
export const LOCATION_TYPES = ['VIEW', 'INTERNAL'] as const;

export const MOVEMENT_TYPES = [
    'PURCHASE', 'SALE', 'PRODUCTION_CONSUMPTION', 'PRODUCTION_OUTPUT',
    'ADJUSTMENT', 'TRANSFER_OUT', 'TRANSFER_IN'
] as const;
export const MOVEMENT_REFERENCE_TYPES = [
    'INVOICE', 'PURCHASE_ORDER', 'MANUFACTURING_ORDER',
    'MATERIAL_REQUEST', 'ADJUSTMENT', 'POS_SALE', 'RETURN'
] as const;

// Other enums
export const RETENTION_TYPES = ['IVA', 'RENTA', 'ISD'] as const;

// SRI Payment Method codes (Ficha Técnica v2.1 — all official codes)
export const PAYMENT_METHODS_SRI = ['01', '15', '16', '17', '18', '19', '20', '21'] as const;
// 01=Sin utilización del sistema financiero, 15=Compensación de deudas
// 16=Tarjeta de débito, 17=Dinero electrónico, 18=Tarjeta prepago
// 19=Tarjeta de crédito, 20=Otros con utilización del SF, 21=Endoso de títulos

export const BOM_CALCULATION_TYPES = ['FIXED', 'AREA', 'PERIMETER', 'VOLUMEN'] as const;
export const TECHNICAL_VISIT_STATUSES = ['SCHEDULED', 'COMPLETED', 'CANCELLED'] as const;
export const JUSTIFICATION_TYPES = ['LIBRE', 'FALTA', 'IESS', 'VACACIONES', 'FERIADO', 'SAB', 'DOM'] as const;
export const POS_SESSION_STATUSES = ['OPEN', 'CLOSED', 'RECONCILED'] as const;

// Product enums
export const PRODUCT_TYPES = ['PRODUCTO', 'SERVICIO'] as const;
export const PRODUCT_SUBTYPES = ['SIMPLE', 'COMPUESTO', 'FABRICADO'] as const;

// SRI IVA rate codes (Ficha Técnica v2.1 — complete)
// 0=0%, 2=12%, 3=14%, 4=15%, 6=No objeto de impuesto, 7=Exento de IVA
export const IVA_RATE_CODES = [0, 2, 3, 4, 6, 7] as const;

// Attribute definition type enum
export const ATTRIBUTE_DATA_TYPES = ['TEXT', 'NUMBER', 'SELECT', 'BOOLEAN'] as const;

// UOM Groups (Physical Dimensions)
export const UOM_GROUPS = ['VOLUMEN', 'LONGITUD', 'PESO', 'AREA', 'CANTIDAD', 'TIEMPO', 'DATA'] as const;

// Purchase order status
export const PURCHASE_ORDER_STATUSES = ['DRAFT', 'SENT', 'PARTIAL', 'RECEIVED', 'CANCELLED'] as const;

// Purchase quote status
export const PURCHASE_QUOTE_STATUSES = ['DRAFT', 'SENT', 'APPROVED', 'REJECTED', 'CONVERTED_TO_PO'] as const;

// Payment status (for invoices, CxC, CxP)
export const PAYMENT_STATUSES = ['PENDING', 'PARTIAL', 'PAID', 'OVERDUE', 'WRITTEN_OFF'] as const;


// Price change source types (for variant_price_history)
export const PRICE_CHANGE_TYPES = ['COST', 'SALE'] as const;
export const PRICE_CHANGE_SOURCES = ['PURCHASE_ORDER', 'GOODS_RECEIPT', 'MANUAL', 'IMPORT'] as const;

// Business types (for company registration)
export const BUSINESS_TYPES = [
    'COMERCIO', 'OPTICA', 'CLINICA', 'TURISMO',
    'MANUFACTURA', 'CONSTRUCCION', 'IMPORTADORA',
] as const;

// SaaS plans
export const SAAS_PLANS = ['free', 'starter', 'pro', 'enterprise'] as const;

// ============================================================================
// TYPESCRIPT TYPES - Derived from const arrays
// ============================================================================

export type TaxIdType = typeof TAX_ID_TYPES[number];
export type PersonType = typeof PERSON_TYPES[number];
export type TaxRegimeType = typeof TAX_REGIME_TYPES[number];
export type QuotationStatus = typeof QUOTATION_STATUSES[number];
export type DocumentType = typeof DOCUMENT_TYPES[number];
export type InvoiceStatus = typeof INVOICE_STATUSES[number];
export type ProductionStatus = typeof PRODUCTION_STATUSES[number];
export type RequestDestination = typeof REQUEST_DESTINATIONS[number];
export type MaterialRequestStatus = typeof MATERIAL_REQUEST_STATUSES[number];
export type WorkOrderStatus = typeof WORK_ORDER_STATUSES[number];
export type Condition = typeof CONDITIONS[number];
export type LocationType = typeof LOCATION_TYPES[number];
export type MovementType = typeof MOVEMENT_TYPES[number];
export type MovementReferenceType = typeof MOVEMENT_REFERENCE_TYPES[number];
export type RetentionType = typeof RETENTION_TYPES[number];
export type PaymentMethodSri = typeof PAYMENT_METHODS_SRI[number];
export type BomCalculationType = typeof BOM_CALCULATION_TYPES[number];
export type TechnicalVisitStatus = typeof TECHNICAL_VISIT_STATUSES[number];
export type JustificationType = typeof JUSTIFICATION_TYPES[number];
export type PosSessionStatus = typeof POS_SESSION_STATUSES[number];
export type ProductType = typeof PRODUCT_TYPES[number];
export type ProductSubtype = typeof PRODUCT_SUBTYPES[number];
export type IvaRateCode = typeof IVA_RATE_CODES[number];
export type AttributeDataType = typeof ATTRIBUTE_DATA_TYPES[number];
export type UomGroup = typeof UOM_GROUPS[number];
export type PurchaseOrderStatus = typeof PURCHASE_ORDER_STATUSES[number];
export type PurchaseQuoteStatus = typeof PURCHASE_QUOTE_STATUSES[number];
export type PaymentStatus = typeof PAYMENT_STATUSES[number];
export type PriceChangeType = typeof PRICE_CHANGE_TYPES[number];
export type PriceChangeSource = typeof PRICE_CHANGE_SOURCES[number];
export type BusinessType = typeof BUSINESS_TYPES[number];
export type SaasPlan = typeof SAAS_PLANS[number];

// ============================================================================
// PG ENUMS - For Drizzle schema definitions
// ============================================================================

export const taxIdTypeEnum = pgEnum('tax_id_type', TAX_ID_TYPES);
export const personTypeEnum = pgEnum('person_type', PERSON_TYPES);
export const taxRegimeTypeEnum = pgEnum('tax_regime_type', TAX_REGIME_TYPES);
export const quotationStatusEnum = pgEnum('quotation_status', QUOTATION_STATUSES);
export const documentTypeEnum = pgEnum('document_type', DOCUMENT_TYPES);
export const invoiceStatusEnum = pgEnum('invoice_status', INVOICE_STATUSES);
export const productionStatusEnum = pgEnum('production_status', PRODUCTION_STATUSES);
export const requestDestinationEnum = pgEnum('request_destination', REQUEST_DESTINATIONS);
export const materialRequestStatusEnum = pgEnum('material_request_status', MATERIAL_REQUEST_STATUSES);
export const workOrderStatusEnum = pgEnum('work_order_status', WORK_ORDER_STATUSES);
export const conditionEnum = pgEnum('condition', CONDITIONS);
export const locationTypeEnum = pgEnum('location_type', LOCATION_TYPES);
export const movementReferenceTypeEnum = pgEnum('movement_reference_type', MOVEMENT_REFERENCE_TYPES);
export const retentionTypeEnum = pgEnum('retention_type', RETENTION_TYPES);
export const productTypeEnum = pgEnum('product_type', PRODUCT_TYPES);
export const productSubtypeEnum = pgEnum('product_subtype', PRODUCT_SUBTYPES);
export const movementTypeEnum = pgEnum('movement_type', MOVEMENT_TYPES);
export const paymentMethodSriEnum = pgEnum('payment_method_sri', PAYMENT_METHODS_SRI);
export const bomCalculationTypeEnum = pgEnum('bom_calculation_type', BOM_CALCULATION_TYPES);
export const technicalVisitStatusEnum = pgEnum('technical_visit_status', TECHNICAL_VISIT_STATUSES);
export const justificationTypeEnum = pgEnum('justification_type', JUSTIFICATION_TYPES);
export const posSessionStatusEnum = pgEnum('pos_session_status', POS_SESSION_STATUSES);
export const attributeDataTypeEnum = pgEnum('attribute_data_type', ATTRIBUTE_DATA_TYPES);
export const uomGroupEnum = pgEnum('uom_group', UOM_GROUPS);
export const purchaseOrderStatusEnum = pgEnum('purchase_order_status', PURCHASE_ORDER_STATUSES);
export const purchaseQuoteStatusEnum = pgEnum('purchase_quote_status', PURCHASE_QUOTE_STATUSES);
export const paymentStatusEnum = pgEnum('payment_status', PAYMENT_STATUSES);
export const priceChangeTypeEnum = pgEnum('price_change_type', PRICE_CHANGE_TYPES);
export const priceChangeSourceEnum = pgEnum('price_change_source', PRICE_CHANGE_SOURCES);

// ============================================================================
// RBAC ENUMS — Single Source of Truth for permissions
// ============================================================================

export const SYSTEM_ROLES = {
    SUPERADMIN: 'superadmin',
    ADMIN: 'admin',
} as const;

/** All business modules that can have permissions */
export const RBAC_MODULES = [
    'dashboard',
    // CRM children
    'crm', 'clients', 'visits', 'budgets', 'invoices',
    // Catalog children
    'products', 'services', 'categories', 'brands', 'families', 'uom', 'attributes',
    // Warehouse children
    'inventory', 'movements', 'orders', 'locations', 'reception_materials', 'remission_guides',
    // Operations children
    'operations', 'work_orders', 'schedule', 'projects',
    // Production children
    'production', 'planning', 'bom', 'dispatch_requests', 'materials',
    // Purchases children
    'suppliers', 'purchase_quotes', 'purchase_orders', 'purchase_invoices', 'retentions',
    // POS children
    'pos_sell', 'pos_sessions', 'pos_history',
    // Finance children
    'documents', 'receivable', 'payable',
    // HR children
    'hr', 'payroll', 'schedules', 'hours',
    // System children
    'system', 'config', 'users', 'audit', 'roles', 'permissions',
    // Other
    'manufacturing', 'pos', 'menu', 'companies', 'stock_taking',
] as const;

/** Standard CRUD actions */
export const RBAC_ACTIONS = ['read', 'create', 'update', 'delete', 'restore', 'destroy', 'export', 'import', 'assign', 'unassign'] as const;

export type RbacModule = typeof RBAC_MODULES[number];
export type RbacAction = typeof RBAC_ACTIONS[number];

/** Compile-time permission slug: 'suppliers.create' | 'invoices.read' | ... */
export type PermissionSlug = `${RbacModule}.${RbacAction}`;
