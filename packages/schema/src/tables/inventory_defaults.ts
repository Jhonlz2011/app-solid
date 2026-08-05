import { integer, primaryKey, index, foreignKey } from 'drizzle-orm/pg-core';
import { pgTableV2, tenantPolicy } from '../utils';
import { companies } from './config';
import { productVariants } from './products';
import { warehouses, warehouseLocations } from './inventory';

/**
 * Establece ubicaciones predeterminadas para un SKU específico en cada bodega del inquilino.
 * 
 * Composite FKs ensure:
 * - variant belongs to the same tenant (company_id match)
 * - warehouse belongs to the same tenant (company_id match)
 * - default_location actually belongs to the specified warehouse (cross-integrity)
 */
export const productVariantWarehouseLocations = pgTableV2("product_variant_warehouse_locations", {
    company_id: integer("company_id")
        .references(() => companies.id)
        .notNull(),
    variant_id: integer("variant_id").notNull(),
    warehouse_id: integer("warehouse_id").notNull(),
    default_location_id: integer("default_location_id").notNull(),
}, (t) => [
    primaryKey({ columns: [t.variant_id, t.warehouse_id] }),

    // Variant pertenece al tenant
    foreignKey({
        name: "fk_pvwl_variant_tenant",
        columns: [t.variant_id, t.company_id],
        foreignColumns: [productVariants.id, productVariants.company_id],
    }),
    // Warehouse pertenece al tenant
    foreignKey({
        name: "fk_pvwl_warehouse_tenant",
        columns: [t.warehouse_id, t.company_id],
        foreignColumns: [warehouses.id, warehouses.company_id],
    }),
    // Location pertenece al warehouse (requires unique(id, warehouse_id) on warehouseLocations)
    foreignKey({
        name: "fk_pvwl_location_warehouse",
        columns: [t.default_location_id, t.warehouse_id],
        foreignColumns: [warehouseLocations.id, warehouseLocations.warehouse_id],
    }),

    index("idx_pvwl_company").on(t.company_id),
    // Reverse index: "¿qué variantes usan esta ubicación como default?"
    index("idx_pvwl_location").on(t.default_location_id),
    tenantPolicy(),
]).enableRLS();
