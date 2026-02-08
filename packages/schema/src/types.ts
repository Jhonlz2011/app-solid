import { type InferSelectModel, type InferInsertModel } from 'drizzle-orm';
import * as tables from './tables';

// --- PRODUCTS ---
export type Product = InferSelectModel<typeof tables.products>;
export type NewProduct = InferInsertModel<typeof tables.products>;

// --- ENTITIES ---
export type Entity = InferSelectModel<typeof tables.entities>;
export type NewEntity = InferInsertModel<typeof tables.entities>;

// --- WORK ORDERS ---
export type WorkOrder = InferSelectModel<typeof tables.workOrders>;
export type NewWorkOrder = InferInsertModel<typeof tables.workOrders>;

// --- INVENTORY ---
export type InventoryStock = InferSelectModel<typeof tables.inventoryStock>;
export type NewInventoryStock = InferInsertModel<typeof tables.inventoryStock>;

// --- AUTH ---
export type AuthUser = InferSelectModel<typeof tables.authUsers>;
export type NewAuthUser = InferInsertModel<typeof tables.authUsers>;
