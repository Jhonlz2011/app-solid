// products/models/products.types.ts
// Types inferred from Eden + UI constants
import { productsApi, type ProductFilters } from '../data/products.api';

// Re-export ProductFilters from api
export type { ProductFilters };

// Infer types from Eden API responses
export type Product = Awaited<ReturnType<typeof productsApi.get>>;
export type ProductsResponse = Awaited<ReturnType<typeof productsApi.list>>;
export type Brand = Awaited<ReturnType<typeof productsApi.listBrands>>[number];
export type UOM = Awaited<ReturnType<typeof productsApi.listUoms>>[number];
export type AttributeDefinition = Awaited<ReturnType<typeof productsApi.listAttributes>>[number];

// Category is a recursive tree structure - need explicit interface
// because backend returns `any` for the tree
type CategoryBase = Awaited<ReturnType<typeof productsApi.listCategories>>[number];
export interface Category extends Omit<CategoryBase, 'children'> {
    children?: Category[];
}

// Product class type from product
export type ProductClass = Product['product_type'];

// UI Label mappings
export const productTypeLabels: Record<string, string> = {
    PRODUCTO: 'Producto',
    SERVICIO: 'Servicio',
};

export const productSubtypeLabels: Record<string, string> = {
    SIMPLE: 'Simple',
    COMPUESTO: 'Compuesto',
    FABRICADO: 'Fabricado',
};

export const ivaRateLabels: Record<number, string> = {
    0: '0%',
    2: '12%',
    4: '15%',
};
