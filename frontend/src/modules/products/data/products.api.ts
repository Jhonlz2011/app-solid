// products/data/products.api.ts
// Pure API functions using shared/lib/http
import { request } from '@shared/lib/http';
import type {
    Product,
    ProductPayload,
    ProductsResponse,
    ProductFilters,
    Category,
    Brand,
    UOM,
    AttributeDefinition,
} from '../models/products.type';

export const productsApi = {
    // Products CRUD
    list: (filters?: ProductFilters): Promise<ProductsResponse> => {
        return request<ProductsResponse>('/products', { params: filters });
    },

    get: (id: number): Promise<Product> => {
        return request<Product>(`/products/${id}`);
    },

    create: (data: ProductPayload): Promise<Product> => {
        return request<Product>('/products', {
            method: 'POST',
            body: JSON.stringify(data),
        });
    },

    update: (id: number, data: Partial<ProductPayload>): Promise<Product> => {
        return request<Product>(`/products/${id}`, {
            method: 'PUT',
            body: JSON.stringify(data),
        });
    },

    delete: (id: number): Promise<void> => {
        return request(`/products/${id}`, { method: 'DELETE' });
    },

    // Categories
    listCategories: (): Promise<Category[]> => {
        return request<Category[]>('/categories');
    },

    getCategoryWithAttributes: (id: number): Promise<Category> => {
        return request<Category>(`/categories/${id}`);
    },

    createCategory: (data: { name: string; parentId?: number; nameTemplate?: string }): Promise<Category> => {
        return request<Category>('/categories', {
            method: 'POST',
            body: JSON.stringify(data),
        });
    },

    // Brands
    listBrands: (): Promise<Brand[]> => {
        return request<Brand[]>('/catalogs/brands');
    },

    createBrand: (data: { name: string; website?: string }): Promise<Brand> => {
        return request<Brand>('/catalogs/brands', {
            method: 'POST',
            body: JSON.stringify(data),
        });
    },

    // UOM
    listUoms: (): Promise<UOM[]> => {
        return request<UOM[]>('/catalogs/uom');
    },

    // Attribute Definitions
    listAttributes: (): Promise<AttributeDefinition[]> => {
        return request<AttributeDefinition[]>('/catalogs/attributes');
    },
};
