import { relations } from 'drizzle-orm';
import * as tables from './tables';

// 1. Entities & Contacts
export const entitiesRelations = relations(tables.entities, ({ one, many }) => ({
    employeeDetails: one(tables.employeeDetails, {
        fields: [tables.entities.id],
        references: [tables.employeeDetails.entity_id],
    }),
    addresses: many(tables.entityAddresses),
    contacts: many(tables.entityContacts),
    workSchedules: many(tables.employeeWorkSchedules),
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

// 2. Auth & Roles
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
    roles: many(tables.authUserRoles),
    sessions: many(tables.sessions),
    entity: one(tables.entities, {
        fields: [tables.authUsers.entity_id],
        references: [tables.entities.id],
    }),
}));

export const sessionsRelations = relations(tables.sessions, ({ one }) => ({
    user: one(tables.authUsers, {
        fields: [tables.sessions.user_id],
        references: [tables.authUsers.id],
    }),
}));

export const authMenuItemsRelations = relations(tables.authMenuItems, ({ one, many }) => ({
    parent: one(tables.authMenuItems, {
        fields: [tables.authMenuItems.parent_id],
        references: [tables.authMenuItems.id],
        relationName: 'menuParentChild',
    }),
    children: many(tables.authMenuItems, { relationName: 'menuParentChild' }),
}));

// 3. Products
export const productsRelations = relations(tables.products, ({ one, many }) => ({
    category: one(tables.categories, { fields: [tables.products.category_id], references: [tables.categories.id] }),
    brand: one(tables.brands, { fields: [tables.products.brand_id], references: [tables.brands.id] }),

    // NUEVO: Relación 1 a 1 con dimensiones
    dimensions: one(tables.productDimensions, {
        fields: [tables.products.id],
        references: [tables.productDimensions.product_id]
    }),

    // NEW: Product variants (e.g., Tube 3m vs 6m)
    variants: many(tables.productVariants),

    // NEW: Components (for divisible products)
    components: many(tables.productComponents),

    // NEW: UOM conversions
    uomConversions: many(tables.productUomConversions),

    // NEW: Multiple prices per product
    prices: many(tables.productPrices),

    supplierProducts: many(tables.supplierProducts),
    inventoryStock: many(tables.inventoryStock),
    dimensionalItems: many(tables.inventoryDimensionalItems),
    movements: many(tables.inventoryMovements),
    workOrderItems: many(tables.workOrderItems),
}));

// NEW: Price Lists Relations
export const priceListsRelations = relations(tables.priceLists, ({ many }) => ({
    productPrices: many(tables.productPrices),
}));

// NEW: Product Prices Relations
export const productPricesRelations = relations(tables.productPrices, ({ one }) => ({
    product: one(tables.products, { fields: [tables.productPrices.product_id], references: [tables.products.id] }),
    priceList: one(tables.priceLists, { fields: [tables.productPrices.price_list_id], references: [tables.priceLists.id] }),
}));

// NEW: Product Variants Relations
export const productVariantsRelations = relations(tables.productVariants, ({ one, many }) => ({
    product: one(tables.products, { fields: [tables.productVariants.product_id], references: [tables.products.id] }),
    dimensionalItems: many(tables.inventoryDimensionalItems),
}));

// NEW: Product Components Relations
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

// NEW: Product UOM Conversions Relations
export const productUomConversionsRelations = relations(tables.productUomConversions, ({ one }) => ({
    product: one(tables.products, { fields: [tables.productUomConversions.product_id], references: [tables.products.id] }),
}));

export const productDimensionsRelations = relations(tables.productDimensions, ({ one }) => ({
    product: one(tables.products, {
        fields: [tables.productDimensions.product_id],
        references: [tables.products.id],
    }),
}));

// 4. Inventory
export const warehousesRelations = relations(tables.warehouses, ({ many }) => ({
    movements: many(tables.inventoryMovements),
}));

export const inventoryMovementsRelations = relations(tables.inventoryMovements, ({ one }) => ({
    warehouse: one(tables.warehouses, { fields: [tables.inventoryMovements.warehouse_id], references: [tables.warehouses.id] }),
    product: one(tables.products, { fields: [tables.inventoryMovements.product_id], references: [tables.products.id] }),
    dimensionalItem: one(tables.inventoryDimensionalItems, { fields: [tables.inventoryMovements.dimensional_item_id], references: [tables.inventoryDimensionalItems.id] }),
    user: one(tables.authUsers, { fields: [tables.inventoryMovements.created_by], references: [tables.authUsers.id] }),
}));

export const inventoryDimensionalItemsRelations = relations(tables.inventoryDimensionalItems, ({ one, many }) => ({
    product: one(tables.products, { fields: [tables.inventoryDimensionalItems.product_id], references: [tables.products.id] }),
    warehouse: one(tables.warehouses, { fields: [tables.inventoryDimensionalItems.warehouse_id], references: [tables.warehouses.id] }),
    // NEW: Link to specific variant
    variant: one(tables.productVariants, { fields: [tables.inventoryDimensionalItems.variant_id], references: [tables.productVariants.id] }),
    // Parent item (for scraps)
    parentItem: one(tables.inventoryDimensionalItems, {
        fields: [tables.inventoryDimensionalItems.parent_item_id],
        references: [tables.inventoryDimensionalItems.id],
        relationName: 'parentChild'
    }),
    childItems: many(tables.inventoryDimensionalItems, { relationName: 'parentChild' }),
    // Un item físico puede haber estado en muchos movimientos
    movements: many(tables.inventoryMovements),
}));

// 5. Electronic Documents (Polimorfismo)
export const electronicDocumentsRelations = relations(tables.electronicDocuments, ({ one }) => ({
    // Relaciones "hacia abajo" (Herencia)
    invoiceDetails: one(tables.invoices, { fields: [tables.electronicDocuments.id], references: [tables.invoices.document_id] }),
    creditNoteDetails: one(tables.creditNotes, { fields: [tables.electronicDocuments.id], references: [tables.creditNotes.document_id] }),
    remissionDetails: one(tables.remissionGuides, { fields: [tables.electronicDocuments.id], references: [tables.remissionGuides.document_id] }),

    // Relación "hacia arriba" (Quien emite/recibe)
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
    // La nueva relación vital
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

// 6. Details
export const invoiceItemsRelations = relations(tables.invoiceItems, ({ one }) => ({
    invoice: one(tables.invoices, { fields: [tables.invoiceItems.invoice_id], references: [tables.invoices.document_id] }),
    product: one(tables.products, { fields: [tables.invoiceItems.product_id], references: [tables.products.id] }),
}));

export const invoicePaymentsRelations = relations(tables.invoicePayments, ({ one }) => ({
    invoice: one(tables.invoices, { fields: [tables.invoicePayments.invoice_id], references: [tables.invoices.document_id] }),
    registrar: one(tables.authUsers, { fields: [tables.invoicePayments.created_by], references: [tables.authUsers.id] }),
}));

export const taxRetentionsRelations = relations(tables.taxRetentions, ({ one }) => ({
    invoice: one(tables.invoices, { fields: [tables.taxRetentions.invoice_id], references: [tables.invoices.document_id] }),
}));

// 7. Manufacturing & Categories
export const categoriesRelations = relations(tables.categories, ({ one, many }) => ({
    parent: one(tables.categories, { fields: [tables.categories.parent_id], references: [tables.categories.id], relationName: 'parent_child_cat' }),
    children: many(tables.categories, { relationName: 'parent_child_cat' }),
    products: many(tables.products),
    attributes: many(tables.categoryAttributes),
}));

export const categoryAttributesRelations = relations(tables.categoryAttributes, ({ one }) => ({
    category: one(tables.categories, { fields: [tables.categoryAttributes.category_id], references: [tables.categories.id] }),
    definition: one(tables.attributeDefinitions, { fields: [tables.categoryAttributes.attribute_def_id], references: [tables.attributeDefinitions.id] }),
}));

export const workOrdersRelations = relations(tables.workOrders, ({ one, many }) => ({
    client: one(tables.entities, { fields: [tables.workOrders.client_id], references: [tables.entities.id] }),
    materialRequests: many(tables.materialRequests),
    items: many(tables.workOrderItems),
    workSchedules: many(tables.employeeWorkSchedules),
}));

export const workOrderItemsRelations = relations(tables.workOrderItems, ({ one }) => ({
    workOrder: one(tables.workOrders, { fields: [tables.workOrderItems.work_order_id], references: [tables.workOrders.id] }),
    product: one(tables.products, { fields: [tables.workOrderItems.product_id], references: [tables.products.id] }),
}));

// NEW: BOM Templates Relations
export const bomTemplatesRelations = relations(tables.bomTemplates, ({ one, many }) => ({
    category: one(tables.categories, { fields: [tables.bomTemplates.category_id], references: [tables.categories.id] }),
    details: many(tables.bomTemplateDetails),
}));

export const bomTemplateDetailsRelations = relations(tables.bomTemplateDetails, ({ one }) => ({
    template: one(tables.bomTemplates, { fields: [tables.bomTemplateDetails.template_id], references: [tables.bomTemplates.id] }),
    componentProduct: one(tables.products, { fields: [tables.bomTemplateDetails.component_product_id], references: [tables.products.id] }),
}));

// Manufacturing Log Relations (with dimensional tracking)
export const manufacturingLogRelations = relations(tables.manufacturingLog, ({ one }) => ({
    manufacturingOrder: one(tables.manufacturingOrders, { fields: [tables.manufacturingLog.manufacturing_order_id], references: [tables.manufacturingOrders.id] }),
    product: one(tables.products, { fields: [tables.manufacturingLog.product_id], references: [tables.products.id] }),
    dimensionalItem: one(tables.inventoryDimensionalItems, { fields: [tables.manufacturingLog.dimensional_item_id], references: [tables.inventoryDimensionalItems.id] }),
    scrapItem: one(tables.inventoryDimensionalItems, {
        fields: [tables.manufacturingLog.scrap_item_id],
        references: [tables.inventoryDimensionalItems.id],
        relationName: 'scrapItem'
    }),
    createdByUser: one(tables.authUsers, { fields: [tables.manufacturingLog.created_by], references: [tables.authUsers.id] }),
}));

// Manufacturing Order Inputs Relations
export const manufacturingOrderInputsRelations = relations(tables.manufacturingOrderInputs, ({ one }) => ({
    manufacturingOrder: one(tables.manufacturingOrders, { fields: [tables.manufacturingOrderInputs.manufacturing_order_id], references: [tables.manufacturingOrders.id] }),
    product: one(tables.products, { fields: [tables.manufacturingOrderInputs.product_id], references: [tables.products.id] }),
    reservedItem: one(tables.inventoryDimensionalItems, { fields: [tables.manufacturingOrderInputs.reserved_dimensional_item_id], references: [tables.inventoryDimensionalItems.id] }),
    addedByUser: one(tables.authUsers, { fields: [tables.manufacturingOrderInputs.added_by], references: [tables.authUsers.id] }),
}));

// Manufacturing Orders Relations
export const manufacturingOrdersRelations = relations(tables.manufacturingOrders, ({ one, many }) => ({
    workOrder: one(tables.workOrders, { fields: [tables.manufacturingOrders.work_order_id], references: [tables.workOrders.id] }),
    outputProduct: one(tables.products, { fields: [tables.manufacturingOrders.output_product_id], references: [tables.products.id] }),
    supervisor: one(tables.entities, { fields: [tables.manufacturingOrders.assigned_supervisor_id], references: [tables.entities.id] }),
    inputs: many(tables.manufacturingOrderInputs),
    logs: many(tables.manufacturingLog),
}));

// NEW: BOM Headers/Details Relations
export const bomHeadersRelations = relations(tables.bomHeaders, ({ one, many }) => ({
    product: one(tables.products, { fields: [tables.bomHeaders.product_id], references: [tables.products.id] }),
    details: many(tables.bomDetails),
}));

export const bomDetailsRelations = relations(tables.bomDetails, ({ one }) => ({
    bomHeader: one(tables.bomHeaders, { fields: [tables.bomDetails.bom_id], references: [tables.bomHeaders.id] }),
    componentProduct: one(tables.products, { fields: [tables.bomDetails.component_product_id], references: [tables.products.id] }),
}));

// NEW: POS Relations
export const cashRegistersRelations = relations(tables.cashRegisters, ({ one, many }) => ({
    warehouse: one(tables.warehouses, { fields: [tables.cashRegisters.warehouse_id], references: [tables.warehouses.id] }),
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
}));

export const posSaleItemsRelations = relations(tables.posSaleItems, ({ one }) => ({
    sale: one(tables.posSales, { fields: [tables.posSaleItems.sale_id], references: [tables.posSales.id] }),
    product: one(tables.products, { fields: [tables.posSaleItems.product_id], references: [tables.products.id] }),
    dimensionalItem: one(tables.inventoryDimensionalItems, { fields: [tables.posSaleItems.dimensional_item_id], references: [tables.inventoryDimensionalItems.id] }),
}));
