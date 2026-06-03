import { integer, primaryKey } from 'drizzle-orm/pg-core';
import { pgTableV2 } from '../utils';
import { productVariants } from './products';
import { warehouses, warehouseLocations } from './inventory';

/**
 * Establece ubicaciones predeterminadas para un SKU específico en cada bodega del inquilino.
 * Resuelve la limitación de ubicación única del modelo previo.
 */
export const productVariantWarehouseLocations = pgTableV2("product_variant_warehouse_locations", {
    variant_id: integer("variant_id")
        .references(() => productVariants.id, { onDelete: 'cascade' })
        .notNull(),
    warehouse_id: integer("warehouse_id")
        .references(() => warehouses.id, { onDelete: 'cascade' })
        .notNull(),
    default_location_id: integer("default_location_id")
        .references(() => warehouseLocations.id, { onDelete: 'restrict' })
        .notNull(),
}, (t) => [
    primaryKey({ columns: [t.variant_id, t.warehouse_id] }),
]);
