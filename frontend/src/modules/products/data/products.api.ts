// products/data/products.api.ts
// Pure API functions using Eden treaty client - Types inferred from backend
import { api } from '@shared/lib/eden';

// Type utilities - Extract body types from Eden
type ProductBody = Parameters<typeof api.api.products.post>[0];
// For parameterized routes, we need to call the function first to access the method
type ProductUpdateBody = NonNullable<Parameters<ReturnType<typeof api.api.products>['put']>[0]>;
type CategoryBody = Parameters<typeof api.api.categories.post>[0];
type BrandBody = Parameters<typeof api.api.catalogs.brands.post>[0];

// Filter type for list queries (defined here to avoid circular dependency)
export interface ProductFilters {
    search?: string;
    categoryId?: number;
    brandId?: number;
    productType?: string;
    productSubtype?: string;
    isActive?: boolean;
    limit?: number;
    offset?: number;
}

// Helper to convert ProductFilters to query string params
const toQueryParams = (filters?: ProductFilters): Record<string, string> | undefined => {
    if (!filters) return undefined;
    const query: Record<string, string> = {};
    if (filters.search) query.search = filters.search;
    if (filters.categoryId) query.categoryId = String(filters.categoryId);
    if (filters.brandId) query.brandId = String(filters.brandId);
    if (filters.productType) query.productType = filters.productType;
    if (filters.productSubtype) query.productSubtype = filters.productSubtype;
    if (filters.isActive !== undefined) query.isActive = String(filters.isActive);
    if (filters.limit) query.limit = String(filters.limit);
    if (filters.offset) query.offset = String(filters.offset);
    return Object.keys(query).length > 0 ? query : undefined;
};

export const productsApi = {
    // Products CRUD
    list: async (filters?: ProductFilters) => {
        const { data, error } = await api.api.products.get({ query: toQueryParams(filters) });
        if (error) throw new Error(String(error.value));
        return data!;
    },

    get: async (id: number) => {
        const { data, error } = await api.api.products({ id }).get();
        if (error) throw new Error(String(error.value));
        return data!;
    },

    create: async (body: ProductBody) => {
        const { data, error } = await api.api.products.post(body);
        if (error) throw new Error(String(error.value));
        return data!;
    },

    update: async (id: number, body: ProductUpdateBody) => {
        const { data, error } = await api.api.products({ id }).put(body);
        if (error) throw new Error(String(error.value));
        return data!;
    },

    delete: async (id: number) => {
        const { error } = await api.api.products({ id }).delete();
        if (error) throw new Error(String(error.value));
    },

    // Categories
    listCategories: async () => {
        const { data, error } = await api.api.categories.get();
        if (error) throw new Error(String(error.value));
        return data!;
    },

    getCategoryWithAttributes: async (id: number) => {
        const { data, error } = await api.api.categories({ id }).get();
        if (error) throw new Error(String(error.value));
        return data!;
    },

    createCategory: async (body: CategoryBody) => {
        const { data, error } = await api.api.categories.post(body);
        if (error) throw new Error(String(error.value));
        return data!;
    },

    // Brands
    listBrands: async () => {
        const { data, error } = await api.api.catalogs.brands.get();
        if (error) throw new Error(String(error.value));
        return data!;
    },

    createBrand: async (body: BrandBody) => {
        const { data, error } = await api.api.catalogs.brands.post(body);
        if (error) throw new Error(String(error.value));
        return data!;
    },

    // UOM
    listUoms: async () => {
        const { data, error } = await api.api.catalogs.uom.get();
        if (error) throw new Error(String(error.value));
        return data!;
    },

    // Attribute Definitions
    listAttributes: async () => {
        const { data, error } = await api.api.catalogs.attributes.get();
        if (error) throw new Error(String(error.value));
        return data!;
    },
};

// Re-export inferred types for consumers
export type { ProductBody, ProductUpdateBody, CategoryBody, BrandBody };
