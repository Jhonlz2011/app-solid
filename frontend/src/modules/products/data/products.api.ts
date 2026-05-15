/**
 * products.api.ts — Pure Eden API fetchers for Products module
 *
 * Strictly fetchers — no hooks, no mutations.
 * All response types inferred from backend response schemas.
 */
import { api } from '@shared/lib/eden';
import { throwApiError } from '@shared/utils/api-errors';
import type { ProductFormData } from '@app/schema/frontend';
import type { ProductType, ProductSubtype } from '@app/schema/frontend';

// =============================================================================
// API Fetchers
// =============================================================================

export const productsApi = {
    list: async (params: ProductFilters) => {
        const { data, error } = await api.api.products.get({
            query: {
                cursor: params.cursor,
                direction: params.direction,
                limit: params.limit,
                search: params.search,
                sortBy: params.sortBy,
                sortOrder: params.sortOrder,
                page: params.page,
                categoryId: params.categoryId?.join(','),
                brandId: params.brandId?.join(','),
                productType: params.productType?.join(','),
                isActive: params.isActive?.join(','),
            },
        });
        if (error) throwApiError(error);
        return data!;
    },

    get: async (id: number) => {
        const { data, error } = await api.api.products({ id }).get();
        if (error) throwApiError(error);
        return data!;
    },

    deactivate: async (id: number) => {
        const { error } = await (api.api.products as any)({ id }).deactivate.patch();
        if (error) throwApiError(error);
    },

    restore: async (id: number) => {
        const { error } = await (api.api.products as any)({ id }).restore.patch();
        if (error) throwApiError(error);
    },

    hardDelete: async (id: number) => {
        const { error } = await (api.api.products as any)({ id }).delete();
        if (error) throwApiError(error);
    },

    bulkDelete: async (ids: number[]) => {
        const { data, error } = await (api.api.products.bulk as any).delete({ ids });
        if (error) throwApiError(error);
        return data!;
    },

    bulkRestore: async (ids: number[]) => {
        const { data, error } = await (api.api.products.bulk.restore as any).patch({ ids });
        if (error) throwApiError(error);
        return data!;
    },

    canDelete: async (id: number): Promise<ProductReferences> => {
        const { data, error } = await (api.api.products as any)({ id })['can-delete'].get();
        if (error) throwApiError(error);
        return data as ProductReferences;
    },

    generateSku: async (categoryId?: number, brandId?: number): Promise<string> => {
        const { data, error } = await (api.api.products as any)['generate-sku'].get({
            query: { categoryId, brandId },
        });
        if (error) throwApiError(error);
        return data as string;
    },

    /** Upload product images. Returns full URLs ready for storage. */
    uploadImages: async (files: File[]): Promise<string[]> => {
        if (files.length === 0) return [];
        const apiBase = import.meta.env.VITE_API_URL || 'http://localhost:3000';
        const formData = new FormData();
        files.forEach(f => formData.append('files', f));
        const res = await fetch(`${apiBase}/api/uploads/products`, {
            method: 'POST',
            body: formData,
            credentials: 'include',
        });
        if (!res.ok) throw new Error('Upload failed');
        const data = await res.json();
        return (data.urls ?? []).map((u: string) => `${apiBase}${u}`);
    },
};

// =============================================================================
// Eden-inferred Types (zero manual interfaces)
// =============================================================================

type ProductsListResponse = Awaited<ReturnType<typeof api.api.products.get>>['data'];
export type ProductListItem = NonNullable<ProductsListResponse>['data'][number];
export type Product = Awaited<ReturnType<typeof productsApi.get>>;
export type ProductBody = ProductFormData;

export interface ProductFilters {
    cursor?: string;
    direction?: 'first' | 'next' | 'prev' | 'last';
    limit?: number;
    search?: string;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
    page?: number;
    categoryId?: string[];
    brandId?: string[];
    productType?: string[];
    isActive?: string[];
}

export interface ProductReferences {
    purchaseOrderItems: number;
    invoiceItems: number;
    workOrderItems: number;
    inventoryMovements: number;
    total: number;
    canDelete: boolean;
}

/** Facet response type from API */
export type FacetData = Record<string, { value: string; label?: string; count: number }[]>;

// =============================================================================
// Query Keys
// =============================================================================

export const productKeys = {
    all: ['products'] as const,
    lists: () => [...productKeys.all, 'list'] as const,
    list: (filters: ProductFilters) => [...productKeys.lists(), filters] as const,
    details: () => [...productKeys.all, 'detail'] as const,
    detail: (id: number) => [...productKeys.details(), id] as const,
    facets: (search?: string, filters?: Record<string, string[] | undefined>) =>
        [...productKeys.all, 'facets', { search, ...filters }] as const,
};

// =============================================================================
// UI Label Mappings (moved from product.types.ts)
// =============================================================================

export const productTypeLabels: Record<ProductType, string> = {
    PRODUCTO: 'Producto',
    SERVICIO: 'Servicio',
};

export const productSubtypeLabels: Record<ProductSubtype, string> = {
    SIMPLE: 'Simple',
    COMPUESTO: 'Compuesto',
    FABRICADO: 'Fabricado',
};

export const productTypeIcons: Record<ProductType, string> = {
    PRODUCTO: '📦',
    SERVICIO: '🔧',
};

export { isActiveLabels } from '@shared/constants/labels';
