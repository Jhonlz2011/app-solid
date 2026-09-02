/**
 * products.api.ts — Pure Eden API fetchers for Products module
 *
 * Strictly fetchers — no hooks, no mutations.
 * All response types inferred from backend response schemas.
 */
import { api } from '@shared/lib/eden';
import { throwApiError } from '@shared/utils/api-errors';
import { getApiUrl } from '@shared/config/runtime-env';
import type { ProductFormData } from '@app/schema/frontend';
import type { ProductType, ProductSubtype } from '@app/schema/enums';
import type { ProductBodyType } from '@app/schema/dto';

// =============================================================================
// API Fetchers
// =============================================================================

export const productsApi = {
    list: async (params: ProductFilters) => {
        const { data, error } = await api.products.get({
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
        const { data, error } = await api.products({ id }).get();
        if (error) throwApiError(error);
        return data!;
    },

    create: async (body: ProductBodyType) => {
        const { data, error } = await api.products.post(body);
        if (error) throwApiError(error);
        return data!;
    },

    update: async (id: number, body: Partial<ProductBodyType>) => {
        const { data, error } = await api.products({ id }).put(body);
        if (error) throwApiError(error);
        return data!;
    },

    deactivate: async (id: number) => {
        const { error } = await api.products({ id }).deactivate.patch();
        if (error) throwApiError(error);
    },

    restore: async (id: number) => {
        const { error } = await api.products({ id }).restore.patch();
        if (error) throwApiError(error);
    },

    hardDelete: async (id: number) => {
        const { error } = await api.products({ id }).delete();
        if (error) throwApiError(error);
    },

    bulkDelete: async (ids: (number | string)[]) => {
        const { data, error } = await api.products.bulk.delete({ ids: ids.map(Number) });
        if (error) throwApiError(error);
        return data!;
    },

    bulkRestore: async (ids: (number | string)[]) => {
        const { data, error } = await api.products.bulk.restore.patch({ ids: ids.map(Number) });
        if (error) throwApiError(error);
        return data!;
    },

    canDelete: async (id: number): Promise<ProductReferences> => {
        const { data, error } = await api.products({ id })['can-delete'].get();
        if (error) throwApiError(error);
        return data as ProductReferences;
    },

    generateSku: async (categoryId?: number, brandId?: number): Promise<string> => {
        const { data, error } = await api.products['generate-sku'].get({
            query: { categoryId, brandId },
        });
        if (error) throwApiError(error);
        return data as string;
    },

    /** Upload product images to Cloudflare R2 Public bucket with Sharp optimization. Returns public CDN URLs. */
    uploadImages: async (files: File[]): Promise<string[]> => {
        if (files.length === 0) return [];
        const apiBase = getApiUrl();
        const formData = new FormData();
        files.forEach(f => formData.append('files', f));
        const res = await fetch(`${apiBase}/api/products/upload-images`, {
            method: 'POST',
            body: formData,
            credentials: 'include',
        });
        if (!res.ok) throw new Error('Error al cargar imágenes del producto');
        const data = await res.json();
        return data.urls ?? [];
    },

    /** Delete a product image from R2 public bucket */
    deleteImage: async (url: string) => {
        try {
            const { error } = await api.products['delete-image'].post({ url });
            if (error) console.warn('[R2] Failed to delete orphaned image:', error);
        } catch (err) {
            console.warn('[R2] deleteImage request failed:', err);
        }
    },
};

// =============================================================================
// Eden-inferred Types (zero manual interfaces)
// =============================================================================

type ProductsListResponse = Awaited<ReturnType<typeof api.products.get>>['data'];
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
    inventoryStock: number;
    inventoryMovements: number;
    inventoryDimensionalItems: number;
    purchaseOrderItems: number;
    invoiceItems: number;
    workOrderItems: number;
    manufacturingOrders: number;
    manufacturingOrderInputs: number;
    manufacturingLog: number;
    supplierProducts: number;
    goodsReceiptItems: number;
    materialRequestItems: number;
    materialRequestDispatches: number;
    requestReturnItems: number;
    total: number;
    canDelete: boolean;
}
// =============================================================================
// Query Keys (re-exported from products.keys.ts)
// =============================================================================

export { productKeys } from './products.keys';

// =============================================================================
// UI Label Mappings
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

export { isActiveLabels } from '@shared/constants/labels';
