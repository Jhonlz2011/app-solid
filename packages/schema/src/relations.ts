import { relations } from 'drizzle-orm';
import * as tables from './tables';

// =============================================================================
// 1. Entities & Contacts
// =============================================================================

export const entitiesRelations = relations(tables.entities, ({ one, many }) => ({
    company: one(tables.companies, { fields: [tables.entities.company_id], references: [tables.companies.id] }),
    employeeDetails: one(tables.employeeDetails, {
        fields: [tables.entities.id],
        references: [tables.employeeDetails.entity_id],
    }),
    addresses: many(tables.entityAddresses),
    contacts: many(tables.entityContacts),
    workSchedules: many(tables.employeeWorkSchedules),
}));

export const entityAddressesRelations = relations(tables.entityAddresses, ({ one }) => ({
    entity: one(tables.entities, {
        fields: [tables.entityAddresses.entity_id],
        references: [tables.entities.id],
    }),
}));

export const entityContactsRelations = relations(tables.entityContacts, ({ one }) => ({
    entity: one(tables.entities, {
        fields: [tables.entityContacts.entity_id],
        references: [tables.entities.id],
    }),
}));

export const employeeWorkSchedulesRelations = relations(tables.employeeWorkSchedules, ({ one }) => ({
    employee: one(tables.entities, { fields: [tables.employeeWorkSchedules.employee_id], references: [tables.entities.id] }),
    workOrder: one(tables.workOrders, { fields: [tables.employeeWorkSchedules.work_order_id], references: [tables.workOrders.id] }),
}));

// =============================================================================
// 2. Auth & Roles
// =============================================================================

export const authUserRolesRelations = relations(tables.authUserRoles, ({ one }) => ({
    user: one(tables.authUsers, { fields: [tables.authUserRoles.user_id], references: [tables.authUsers.id] }),
    role: one(tables.authRoles, { fields: [tables.authUserRoles.role_id], references: [tables.authRoles.id] }),
}));

export const authRolesRelations = relations(tables.authRoles, ({ many }) => ({
    permissions: many(tables.authRolePermissions),
    users: many(tables.authUserRoles),
}));

export const authPermissionsRelations = relations(tables.authPermissions, ({ many }) => ({
    roles: many(tables.authRolePermissions),
}));

export const authRolePermissionsRelations = relations(tables.authRolePermissions, ({ one }) => ({
    role: one(tables.authRoles, { fields: [tables.authRolePermissions.role_id], references: [tables.authRoles.id] }),
    permission: one(tables.authPermissions, { fields: [tables.authRolePermissions.permission_id], references: [tables.authPermissions.id] }),
}));

export const authUsersRelations = relations(tables.authUsers, ({ one, many }) => ({
    company: one(tables.companies, { fields: [tables.authUsers.company_id], references: [tables.companies.id] }),
    roles: many(tables.authUserRoles),
    sessions: many(tables.sessions),
    entity: one(tables.entities, {
        fields: [tables.authUsers.entity_id],
        references: [tables.entities.id],
    }),
}));

export const sessionsRelations = relations(tables.sessions, ({ one }) => ({
    user: one(tables.authUsers, { fields: [tables.sessions.user_id], references: [tables.authUsers.id] }),
    company: one(tables.companies, { fields: [tables.sessions.company_id], references: [tables.companies.id] }),
}));

export const auditLogsRelations = relations(tables.auditLogs, ({ one }) => ({
    user: one(tables.authUsers, { fields: [tables.auditLogs.userId], references: [tables.authUsers.id] }),
    company: one(tables.companies, { fields: [tables.auditLogs.company_id], references: [tables.companies.id] }),
}));

export const authMenuItemsRelations = relations(tables.authMenuItems, ({ one, many }) => ({
    parent: one(tables.authMenuItems, {
        fields: [tables.authMenuItems.parent_id],
        references: [tables.authMenuItems.id],
        relationName: 'menuParentChild',
    }),
    children: many(tables.authMenuItems, { relationName: 'menuParentChild' }),
}));

// =============================================================================
// 2.5 Config catalog relations
// =============================================================================

export const brandsRelations = relations(tables.brands, ({ one, many }) => ({
    company: one(tables.companies, { fields: [tables.brands.company_id], references: [tables.companies.id] }),
    products: many(tables.products),
}));

export const uomRelations = relations(tables.uom, ({ many }) => ({
    products: many(tables.products),
}));

export const attributeDefinitionsRelations = relations(tables.attributeDefinitions, ({ many }) => ({
    categoryAttributes: many(tables.categoryAttributes),
}));

// =============================================================================
// 3. Products → Variants (unified 2-layer model)
// =============================================================================

export const productsRelations = relations(tables.products, ({ one, many }) => ({
    company: one(tables.companies, { fields: [tables.products.company_id], references: [tables.companies.id] }),
    category: one(tables.categories, { fields: [tables.products.category_id], references: [tables.categories.id] }),
    brand: one(tables.brands, { fields: [tables.products.brand_id], references: [tables.brands.id] }),
    family: one(tables.productFamilies, { fields: [tables.products.family_id], references: [tables.productFamilies.id] }),
    variants: many(tables.productVariants),
    components: many(tables.productComponents),
    uomConversions: many(tables.productUomConversions),
    bomHeaders: many(tables.bomHeaders),
    workOrderItems: many(tables.workOrderItems),
}));

// Product Variants = the unified transactional entity (SKU)
export const productVariantsRelations = relations(tables.productVariants, ({ one, many }) => ({
    product: one(tables.products, { fields: [tables.productVariants.product_id], references: [tables.products.id] }),
    defaultLocation: one(tables.warehouseLocations, { fields: [tables.productVariants.default_location_id], references: [tables.warehouseLocations.id] }),

    // Transactional relations (things that reference variant_id)
    supplierProducts: many(tables.supplierProducts),
    inventoryStock: many(tables.inventoryStock),
    dimensionalItems: many(tables.inventoryDimensionalItems),
    movements: many(tables.inventoryMovements),
    priceHistory: many(tables.variantPriceHistory),
}));

export const productComponentsRelations = relations(tables.productComponents, ({ one }) => ({
    parentProduct: one(tables.products, {
        fields: [tables.productComponents.parent_product_id],
        references: [tables.products.id],
        relationName: 'parentProduct'
    }),
    componentProduct: one(tables.products, {
        fields: [tables.productComponents.component_product_id],
        references: [tables.products.id],
        relationName: 'componentProduct'
    }),
}));

export const productUomConversionsRelations = relations(tables.productUomConversions, ({ one }) => ({
    product: one(tables.products, { fields: [tables.productUomConversions.product_id], references: [tables.products.id] }),
}));

// =============================================================================
// 4. Inventory
// =============================================================================

export const warehousesRelations = relations(tables.warehouses, ({ one, many }) => ({
    company: one(tables.companies, { fields: [tables.warehouses.company_id], references: [tables.companies.id] }),
    manager: one(tables.entities, { fields: [tables.warehouses.manager_id], references: [tables.entities.id] }),
    locations: many(tables.warehouseLocations),
}));

export const warehouseLocationsRelations = relations(tables.warehouseLocations, ({ one, many }) => ({
    warehouse: one(tables.warehouses, { fields: [tables.warehouseLocations.warehouse_id], references: [tables.warehouses.id] }),
    stock: many(tables.inventoryStock),
    dimensionalItems: many(tables.inventoryDimensionalItems),
}));

export const inventoryStockRelations = relations(tables.inventoryStock, ({ one }) => ({
    location: one(tables.warehouseLocations, {
        fields: [tables.inventoryStock.location_id],
        references: [tables.warehouseLocations.id],
    }),
    variant: one(tables.productVariants, {
        fields: [tables.inventoryStock.variant_id],
        references: [tables.productVariants.id],
    }),
}));

export const inventoryDimensionalItemsRelations = relations(tables.inventoryDimensionalItems, ({ one, many }) => ({
    variant: one(tables.productVariants, { fields: [tables.inventoryDimensionalItems.variant_id], references: [tables.productVariants.id] }),
    location: one(tables.warehouseLocations, { fields: [tables.inventoryDimensionalItems.location_id], references: [tables.warehouseLocations.id] }),
    movements: many(tables.inventoryMovements),
}));

export const inventoryMovementsRelations = relations(tables.inventoryMovements, ({ one }) => ({
    sourceLocation: one(tables.warehouseLocations, { fields: [tables.inventoryMovements.source_location_id], references: [tables.warehouseLocations.id], relationName: 'sourceLocation' }),
    destinationLocation: one(tables.warehouseLocations, { fields: [tables.inventoryMovements.destination_location_id], references: [tables.warehouseLocations.id], relationName: 'destinationLocation' }),
    variant: one(tables.productVariants, { fields: [tables.inventoryMovements.variant_id], references: [tables.productVariants.id] }),
    product: one(tables.products, { fields: [tables.inventoryMovements.product_id], references: [tables.products.id] }),
    dimensionalItem: one(tables.inventoryDimensionalItems, { fields: [tables.inventoryMovements.dimensional_item_id], references: [tables.inventoryDimensionalItems.id] }),
    createdByUser: one(tables.authUsers, { fields: [tables.inventoryMovements.created_by], references: [tables.authUsers.id] }),
}));

// =============================================================================
// 5. Electronic Documents
// =============================================================================

export const electronicDocumentsRelations = relations(tables.electronicDocuments, ({ one }) => ({
    company: one(tables.companies, { fields: [tables.electronicDocuments.company_id], references: [tables.companies.id] }),
    invoiceDetails: one(tables.invoices, { fields: [tables.electronicDocuments.id], references: [tables.invoices.document_id] }),
    creditNoteDetails: one(tables.creditNotes, { fields: [tables.electronicDocuments.id], references: [tables.creditNotes.document_id] }),
    debitNoteDetails: one(tables.debitNotes, { fields: [tables.electronicDocuments.id], references: [tables.debitNotes.document_id] }),
    purchaseLiquidationDetails: one(tables.purchaseLiquidations, { fields: [tables.electronicDocuments.id], references: [tables.purchaseLiquidations.document_id] }),
    withholdingDetails: one(tables.withholdingReceipts, { fields: [tables.electronicDocuments.id], references: [tables.withholdingReceipts.document_id] }),
    remissionDetails: one(tables.remissionGuides, { fields: [tables.electronicDocuments.id], references: [tables.remissionGuides.document_id] }),
    entity: one(tables.entities, { fields: [tables.electronicDocuments.entity_id], references: [tables.entities.id] }),
}));

export const invoicesRelations = relations(tables.invoices, ({ one, many }) => ({
    header: one(tables.electronicDocuments, { fields: [tables.invoices.document_id], references: [tables.electronicDocuments.id] }),
    items: many(tables.invoiceItems),
    payments: many(tables.invoicePayments),
    retentions: many(tables.taxRetentions),
}));

export const remissionGuidesRelations = relations(tables.remissionGuides, ({ one }) => ({
    header: one(tables.electronicDocuments, { fields: [tables.remissionGuides.document_id], references: [tables.electronicDocuments.id] }),
    materialRequest: one(tables.materialRequests, {
        fields: [tables.remissionGuides.origin_material_request_id],
        references: [tables.materialRequests.id],
        relationName: 'request_guide'
    }),
    carrier: one(tables.entities, { fields: [tables.remissionGuides.carrier_id], references: [tables.entities.id] }),
}));

export const creditNotesRelations = relations(tables.creditNotes, ({ one }) => ({
    header: one(tables.electronicDocuments, { fields: [tables.creditNotes.document_id], references: [tables.electronicDocuments.id] }),
    originalDoc: one(tables.electronicDocuments, { fields: [tables.creditNotes.modified_document_id], references: [tables.electronicDocuments.id] }),
}));

export const invoiceItemsRelations = relations(tables.invoiceItems, ({ one }) => ({
    invoice: one(tables.invoices, { fields: [tables.invoiceItems.invoice_id], references: [tables.invoices.document_id] }),
    variant: one(tables.productVariants, { fields: [tables.invoiceItems.variant_id], references: [tables.productVariants.id] }),
}));

export const invoicePaymentsRelations = relations(tables.invoicePayments, ({ one }) => ({
    invoice: one(tables.invoices, { fields: [tables.invoicePayments.invoice_id], references: [tables.invoices.document_id] }),
    registrar: one(tables.authUsers, { fields: [tables.invoicePayments.created_by], references: [tables.authUsers.id] }),
}));

export const taxRetentionsRelations = relations(tables.taxRetentions, ({ one }) => ({
    invoice: one(tables.invoices, { fields: [tables.taxRetentions.invoice_id], references: [tables.invoices.document_id] }),
}));

// =============================================================================
// 6. Visits & Quotations
// =============================================================================

export const quotationsRelations = relations(tables.quotations, ({ one, many }) => ({
    client: one(tables.entities, { fields: [tables.quotations.client_id], references: [tables.entities.id] }),
    technicalVisit: one(tables.technicalVisits, { fields: [tables.quotations.technical_visit_id], references: [tables.technicalVisits.id] }),
    items: many(tables.quotationItems),
}));

export const quotationItemsRelations = relations(tables.quotationItems, ({ one }) => ({
    quotation: one(tables.quotations, { fields: [tables.quotationItems.quotation_id], references: [tables.quotations.id] }),
    variant: one(tables.productVariants, { fields: [tables.quotationItems.variant_id], references: [tables.productVariants.id] }),
}));

// =============================================================================
// 7. Manufacturing & Categories
// =============================================================================

export const categoriesRelations = relations(tables.categories, ({ one, many }) => ({
    company: one(tables.companies, { fields: [tables.categories.company_id], references: [tables.companies.id] }),
    parent: one(tables.categories, { fields: [tables.categories.parent_id], references: [tables.categories.id], relationName: 'parent_child_cat' }),
    children: many(tables.categories, { relationName: 'parent_child_cat' }),
    products: many(tables.products),
    attributes: many(tables.categoryAttributes),
    bomTemplates: many(tables.bomTemplates),
    families: many(tables.productFamilies),
}));

export const categoryAttributesRelations = relations(tables.categoryAttributes, ({ one }) => ({
    category: one(tables.categories, { fields: [tables.categoryAttributes.category_id], references: [tables.categories.id] }),
    definition: one(tables.attributeDefinitions, { fields: [tables.categoryAttributes.attribute_def_id], references: [tables.attributeDefinitions.id] }),
}));

export const workOrdersRelations = relations(tables.workOrders, ({ one, many }) => ({
    company: one(tables.companies, { fields: [tables.workOrders.company_id], references: [tables.companies.id] }),
    client: one(tables.entities, { fields: [tables.workOrders.client_id], references: [tables.entities.id] }),
    quotation: one(tables.quotations, { fields: [tables.workOrders.quotation_id], references: [tables.quotations.id] }),
    materialRequests: many(tables.materialRequests),
    items: many(tables.workOrderItems),
    manufacturingOrders: many(tables.manufacturingOrders),
    purchaseOrders: many(tables.purchaseOrders),
    workSchedules: many(tables.employeeWorkSchedules),
}));

export const workOrderItemsRelations = relations(tables.workOrderItems, ({ one }) => ({
    workOrder: one(tables.workOrders, { fields: [tables.workOrderItems.work_order_id], references: [tables.workOrders.id] }),
    product: one(tables.products, { fields: [tables.workOrderItems.product_id], references: [tables.products.id] }),
}));

export const bomTemplatesRelations = relations(tables.bomTemplates, ({ one, many }) => ({
    company: one(tables.companies, { fields: [tables.bomTemplates.company_id], references: [tables.companies.id] }),
    category: one(tables.categories, { fields: [tables.bomTemplates.category_id], references: [tables.categories.id] }),
    details: many(tables.bomTemplateDetails),
}));

export const bomTemplateDetailsRelations = relations(tables.bomTemplateDetails, ({ one }) => ({
    template: one(tables.bomTemplates, { fields: [tables.bomTemplateDetails.template_id], references: [tables.bomTemplates.id] }),
    componentProduct: one(tables.products, { fields: [tables.bomTemplateDetails.component_product_id], references: [tables.products.id] }),
}));

export const manufacturingLogRelations = relations(tables.manufacturingLog, ({ one }) => ({
    manufacturingOrder: one(tables.manufacturingOrders, { fields: [tables.manufacturingLog.manufacturing_order_id], references: [tables.manufacturingOrders.id] }),
    variant: one(tables.productVariants, { fields: [tables.manufacturingLog.variant_id], references: [tables.productVariants.id] }),
    scrapItem: one(tables.inventoryDimensionalItems, {
        fields: [tables.manufacturingLog.scrap_item_id],
        references: [tables.inventoryDimensionalItems.id],
    }),
    createdByUser: one(tables.authUsers, { fields: [tables.manufacturingLog.created_by], references: [tables.authUsers.id] }),
}));

export const manufacturingOrderInputsRelations = relations(tables.manufacturingOrderInputs, ({ one }) => ({
    manufacturingOrder: one(tables.manufacturingOrders, { fields: [tables.manufacturingOrderInputs.manufacturing_order_id], references: [tables.manufacturingOrders.id] }),
    variant: one(tables.productVariants, { fields: [tables.manufacturingOrderInputs.variant_id], references: [tables.productVariants.id] }),
    addedByUser: one(tables.authUsers, { fields: [tables.manufacturingOrderInputs.added_by], references: [tables.authUsers.id] }),
}));

export const manufacturingOrdersRelations = relations(tables.manufacturingOrders, ({ one, many }) => ({
    workOrder: one(tables.workOrders, { fields: [tables.manufacturingOrders.work_order_id], references: [tables.workOrders.id] }),
    outputVariant: one(tables.productVariants, { fields: [tables.manufacturingOrders.output_variant_id], references: [tables.productVariants.id] }),
    supervisor: one(tables.entities, { fields: [tables.manufacturingOrders.assigned_supervisor_id], references: [tables.entities.id] }),
    inputs: many(tables.manufacturingOrderInputs),
    logs: many(tables.manufacturingLog),
}));

export const bomHeadersRelations = relations(tables.bomHeaders, ({ one, many }) => ({
    product: one(tables.products, { fields: [tables.bomHeaders.product_id], references: [tables.products.id] }),
    sourceTemplate: one(tables.bomTemplates, { fields: [tables.bomHeaders.source_template_id], references: [tables.bomTemplates.id] }),
    details: many(tables.bomDetails),
}));

export const bomDetailsRelations = relations(tables.bomDetails, ({ one }) => ({
    bomHeader: one(tables.bomHeaders, { fields: [tables.bomDetails.bom_id], references: [tables.bomHeaders.id] }),
    componentProduct: one(tables.products, { fields: [tables.bomDetails.component_product_id], references: [tables.products.id] }),
}));

// =============================================================================
// 8. POS
// =============================================================================

export const cashRegistersRelations = relations(tables.cashRegisters, ({ one, many }) => ({
    company: one(tables.companies, { fields: [tables.cashRegisters.company_id], references: [tables.companies.id] }),
    warehouse: one(tables.warehouses, { fields: [tables.cashRegisters.warehouse_id], references: [tables.warehouses.id] }),
    defaultLocation: one(tables.warehouseLocations, { fields: [tables.cashRegisters.default_location_id], references: [tables.warehouseLocations.id] }),
    sessions: many(tables.posSessions),
}));

export const posSessionsRelations = relations(tables.posSessions, ({ one, many }) => ({
    cashRegister: one(tables.cashRegisters, { fields: [tables.posSessions.cash_register_id], references: [tables.cashRegisters.id] }),
    openedByUser: one(tables.authUsers, { fields: [tables.posSessions.opened_by], references: [tables.authUsers.id], relationName: 'sessionOpener' }),
    closedByUser: one(tables.authUsers, { fields: [tables.posSessions.closed_by], references: [tables.authUsers.id], relationName: 'sessionCloser' }),
    sales: many(tables.posSales),
}));

export const posSalesRelations = relations(tables.posSales, ({ one, many }) => ({
    session: one(tables.posSessions, { fields: [tables.posSales.session_id], references: [tables.posSessions.id] }),
    client: one(tables.entities, { fields: [tables.posSales.client_id], references: [tables.entities.id] }),
    document: one(tables.electronicDocuments, { fields: [tables.posSales.document_id], references: [tables.electronicDocuments.id] }),
    createdByUser: one(tables.authUsers, { fields: [tables.posSales.created_by], references: [tables.authUsers.id] }),
    items: many(tables.posSaleItems),
    payments: many(tables.posSalePayments),
}));

export const posSalePaymentsRelations = relations(tables.posSalePayments, ({ one }) => ({
    sale: one(tables.posSales, { fields: [tables.posSalePayments.sale_id], references: [tables.posSales.id] }),
}));

export const posSaleItemsRelations = relations(tables.posSaleItems, ({ one }) => ({
    sale: one(tables.posSales, { fields: [tables.posSaleItems.sale_id], references: [tables.posSales.id] }),
    variant: one(tables.productVariants, { fields: [tables.posSaleItems.variant_id], references: [tables.productVariants.id] }),
    location: one(tables.warehouseLocations, { fields: [tables.posSaleItems.location_id], references: [tables.warehouseLocations.id] }),
}));

// =============================================================================
// 9. Product Families
// =============================================================================

export const productFamiliesRelations = relations(tables.productFamilies, ({ one, many }) => ({
    company: one(tables.companies, { fields: [tables.productFamilies.company_id], references: [tables.companies.id] }),
    category: one(tables.categories, {
        fields: [tables.productFamilies.category_id],
        references: [tables.categories.id],
    }),
    products: many(tables.products),
}));

// =============================================================================
// 10. Request Module
// =============================================================================

export const requestTemplatesRelations = relations(tables.requestTemplates, ({ many }) => ({
    items: many(tables.requestTemplateItems),
}));

export const requestTemplateItemsRelations = relations(tables.requestTemplateItems, ({ one }) => ({
    template: one(tables.requestTemplates, {
        fields: [tables.requestTemplateItems.template_id],
        references: [tables.requestTemplates.id],
    }),
    product: one(tables.products, {
        fields: [tables.requestTemplateItems.product_id],
        references: [tables.products.id],
    }),
}));

export const materialRequestsRelations = relations(tables.materialRequests, ({ one, many }) => ({
    workOrder: one(tables.workOrders, {
        fields: [tables.materialRequests.work_order_id],
        references: [tables.workOrders.id],
    }),
    requester: one(tables.entities, {
        fields: [tables.materialRequests.requester_id],
        references: [tables.entities.id],
    }),
    items: many(tables.materialRequestItems),
    returns: many(tables.requestReturns),
}));

export const materialRequestItemsRelations = relations(tables.materialRequestItems, ({ one, many }) => ({
    request: one(tables.materialRequests, {
        fields: [tables.materialRequestItems.request_id],
        references: [tables.materialRequests.id],
    }),
    variant: one(tables.productVariants, {
        fields: [tables.materialRequestItems.variant_id],
        references: [tables.productVariants.id],
    }),
    family: one(tables.productFamilies, {
        fields: [tables.materialRequestItems.family_id],
        references: [tables.productFamilies.id],
    }),
    dispatches: many(tables.materialRequestDispatches),
}));

export const materialRequestDispatchesRelations = relations(tables.materialRequestDispatches, ({ one }) => ({
    requestItem: one(tables.materialRequestItems, {
        fields: [tables.materialRequestDispatches.request_item_id],
        references: [tables.materialRequestItems.id],
    }),
    variant: one(tables.productVariants, {
        fields: [tables.materialRequestDispatches.variant_id],
        references: [tables.productVariants.id],
    }),
    location: one(tables.warehouseLocations, {
        fields: [tables.materialRequestDispatches.dispatched_from_location_id],
        references: [tables.warehouseLocations.id],
    }),
    dispatchedBy: one(tables.entities, {
        fields: [tables.materialRequestDispatches.dispatched_by],
        references: [tables.entities.id],
    }),
}));

export const requestReturnsRelations = relations(tables.requestReturns, ({ one, many }) => ({
    request: one(tables.materialRequests, {
        fields: [tables.requestReturns.request_id],
        references: [tables.materialRequests.id],
    }),
    receivedBy: one(tables.entities, {
        fields: [tables.requestReturns.received_by],
        references: [tables.entities.id],
    }),
    items: many(tables.requestReturnItems),
}));

export const requestReturnItemsRelations = relations(tables.requestReturnItems, ({ one }) => ({
    returnHeader: one(tables.requestReturns, {
        fields: [tables.requestReturnItems.return_id],
        references: [tables.requestReturns.id],
    }),
    originalRequestItem: one(tables.materialRequestItems, {
        fields: [tables.requestReturnItems.original_request_item_id],
        references: [tables.materialRequestItems.id],
    }),
    variant: one(tables.productVariants, {
        fields: [tables.requestReturnItems.variant_id],
        references: [tables.productVariants.id],
    }),
}));

// =============================================================================
// 11. Supplier & Purchase Order Relations
// =============================================================================

export const supplierProductsRelations = relations(tables.supplierProducts, ({ one }) => ({
    supplier: one(tables.entities, {
        fields: [tables.supplierProducts.supplier_id],
        references: [tables.entities.id],
    }),
    variant: one(tables.productVariants, {
        fields: [tables.supplierProducts.variant_id],
        references: [tables.productVariants.id],
    }),
}));

export const purchaseOrdersRelations = relations(tables.purchaseOrders, ({ one, many }) => ({
    supplier: one(tables.entities, {
        fields: [tables.purchaseOrders.supplier_id],
        references: [tables.entities.id],
    }),
    workOrder: one(tables.workOrders, {
        fields: [tables.purchaseOrders.work_order_id],
        references: [tables.workOrders.id],
    }),
    warehouse: one(tables.warehouses, {
        fields: [tables.purchaseOrders.destination_warehouse_id],
        references: [tables.warehouses.id],
    }),
    createdByUser: one(tables.authUsers, {
        fields: [tables.purchaseOrders.created_by],
        references: [tables.authUsers.id],
    }),
    items: many(tables.purchaseOrderItems),
    receipts: many(tables.goodsReceipts),
}));

export const purchaseOrderItemsRelations = relations(tables.purchaseOrderItems, ({ one }) => ({
    purchaseOrder: one(tables.purchaseOrders, {
        fields: [tables.purchaseOrderItems.purchase_order_id],
        references: [tables.purchaseOrders.id],
    }),
    supplierProduct: one(tables.supplierProducts, {
        fields: [tables.purchaseOrderItems.supplier_product_id],
        references: [tables.supplierProducts.id],
    }),
    variant: one(tables.productVariants, {
        fields: [tables.purchaseOrderItems.variant_id],
        references: [tables.productVariants.id],
    }),
}));

// =============================================================================
// 12. Goods Receipt Relations
// =============================================================================

export const goodsReceiptsRelations = relations(tables.goodsReceipts, ({ one, many }) => ({
    purchaseOrder: one(tables.purchaseOrders, {
        fields: [tables.goodsReceipts.purchase_order_id],
        references: [tables.purchaseOrders.id],
    }),
    warehouse: one(tables.warehouses, {
        fields: [tables.goodsReceipts.warehouse_id],
        references: [tables.warehouses.id],
    }),
    receivedByUser: one(tables.authUsers, {
        fields: [tables.goodsReceipts.received_by],
        references: [tables.authUsers.id],
    }),
    items: many(tables.goodsReceiptItems),
}));

export const goodsReceiptItemsRelations = relations(tables.goodsReceiptItems, ({ one }) => ({
    receipt: one(tables.goodsReceipts, {
        fields: [tables.goodsReceiptItems.receipt_id],
        references: [tables.goodsReceipts.id],
    }),
    purchaseOrderItem: one(tables.purchaseOrderItems, {
        fields: [tables.goodsReceiptItems.purchase_order_item_id],
        references: [tables.purchaseOrderItems.id],
    }),
    variant: one(tables.productVariants, {
        fields: [tables.goodsReceiptItems.variant_id],
        references: [tables.productVariants.id],
    }),
}));

// =============================================================================
// 13. Companies (Multi-tenant root)
// =============================================================================

export const companiesRelations = relations(tables.companies, ({ many }) => ({
    establishments: many(tables.sriEstablishments),
    certificates: many(tables.sriCertificates),
    entities: many(tables.entities),
    users: many(tables.authUsers),
    products: many(tables.products),
    warehouses: many(tables.warehouses),
    documents: many(tables.electronicDocuments),
    workOrders: many(tables.workOrders),
    purchaseOrders: many(tables.purchaseOrders),
    cashRegisters: many(tables.cashRegisters),
    brands: many(tables.brands),
    categories: many(tables.categories),
    productFamilies: many(tables.productFamilies),
    bomTemplates: many(tables.bomTemplates),
    fiscalPeriods: many(tables.fiscalPeriods),
    receivables: many(tables.accountsReceivable),
    payables: many(tables.accountsPayable),
    purchaseQuotes: many(tables.purchaseQuotes),
}));

export const sriEstablishmentsRelations = relations(tables.sriEstablishments, ({ one }) => ({
    company: one(tables.companies, { fields: [tables.sriEstablishments.company_id], references: [tables.companies.id] }),
}));

export const sriCertificatesRelations = relations(tables.sriCertificates, ({ one }) => ({
    company: one(tables.companies, { fields: [tables.sriCertificates.company_id], references: [tables.companies.id] }),
}));

// =============================================================================
// 14. New SRI Document Children
// =============================================================================

export const debitNotesRelations = relations(tables.debitNotes, ({ one }) => ({
    header: one(tables.electronicDocuments, { fields: [tables.debitNotes.document_id], references: [tables.electronicDocuments.id] }),
    originalDoc: one(tables.electronicDocuments, { fields: [tables.debitNotes.modified_document_id], references: [tables.electronicDocuments.id] }),
}));

export const purchaseLiquidationsRelations = relations(tables.purchaseLiquidations, ({ one }) => ({
    header: one(tables.electronicDocuments, { fields: [tables.purchaseLiquidations.document_id], references: [tables.electronicDocuments.id] }),
}));

export const withholdingReceiptsRelations = relations(tables.withholdingReceipts, ({ one, many }) => ({
    header: one(tables.electronicDocuments, { fields: [tables.withholdingReceipts.document_id], references: [tables.electronicDocuments.id] }),
    supplier: one(tables.entities, { fields: [tables.withholdingReceipts.supplier_id], references: [tables.entities.id] }),
    details: many(tables.withholdingReceiptDetails),
}));

export const withholdingReceiptDetailsRelations = relations(tables.withholdingReceiptDetails, ({ one }) => ({
    receipt: one(tables.withholdingReceipts, { fields: [tables.withholdingReceiptDetails.receipt_document_id], references: [tables.withholdingReceipts.document_id] }),
}));

// =============================================================================
// 15. Finance Module
// =============================================================================

export const accountsReceivableRelations = relations(tables.accountsReceivable, ({ one }) => ({
    company: one(tables.companies, { fields: [tables.accountsReceivable.company_id], references: [tables.companies.id] }),
    document: one(tables.electronicDocuments, { fields: [tables.accountsReceivable.document_id], references: [tables.electronicDocuments.id] }),
    entity: one(tables.entities, { fields: [tables.accountsReceivable.entity_id], references: [tables.entities.id] }),
}));

export const accountsPayableRelations = relations(tables.accountsPayable, ({ one }) => ({
    company: one(tables.companies, { fields: [tables.accountsPayable.company_id], references: [tables.companies.id] }),
    purchaseOrder: one(tables.purchaseOrders, { fields: [tables.accountsPayable.purchase_order_id], references: [tables.purchaseOrders.id] }),
    entity: one(tables.entities, { fields: [tables.accountsPayable.entity_id], references: [tables.entities.id] }),
}));

export const fiscalPeriodsRelations = relations(tables.fiscalPeriods, ({ one }) => ({
    company: one(tables.companies, { fields: [tables.fiscalPeriods.company_id], references: [tables.companies.id] }),
    closedByUser: one(tables.authUsers, { fields: [tables.fiscalPeriods.closed_by], references: [tables.authUsers.id] }),
}));

export const purchaseQuotesRelations = relations(tables.purchaseQuotes, ({ one, many }) => ({
    company: one(tables.companies, { fields: [tables.purchaseQuotes.company_id], references: [tables.companies.id] }),
    supplier: one(tables.entities, { fields: [tables.purchaseQuotes.supplier_id], references: [tables.entities.id] }),
    convertedPO: one(tables.purchaseOrders, { fields: [tables.purchaseQuotes.converted_po_id], references: [tables.purchaseOrders.id] }),
    createdByUser: one(tables.authUsers, { fields: [tables.purchaseQuotes.created_by], references: [tables.authUsers.id] }),
    items: many(tables.purchaseQuoteItems),
}));

export const purchaseQuoteItemsRelations = relations(tables.purchaseQuoteItems, ({ one }) => ({
    quote: one(tables.purchaseQuotes, { fields: [tables.purchaseQuoteItems.quote_id], references: [tables.purchaseQuotes.id] }),
    variant: one(tables.productVariants, { fields: [tables.purchaseQuoteItems.variant_id], references: [tables.productVariants.id] }),
}));

// =============================================================================
// 16. Price History
// =============================================================================

export const variantPriceHistoryRelations = relations(tables.variantPriceHistory, ({ one }) => ({
    variant: one(tables.productVariants, { fields: [tables.variantPriceHistory.variant_id], references: [tables.productVariants.id] }),
    changedByUser: one(tables.authUsers, { fields: [tables.variantPriceHistory.changed_by], references: [tables.authUsers.id] }),
}));
