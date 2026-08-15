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
import type { FacetData } from '@app/schema/dto';


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

    /** Obtiene una URL firmada (Presigned URL) de Cloudflare R2 para subir un archivo directamente. */
    getPresignedUploadUrl: async (fileName: string, contentType: string): Promise<{ uploadUrl: string; fileKey: string; publicUrl: string }> => {
        const { data, error } = await (api.api.products as any)['upload-url'].post({
            fileName,
            contentType,
        });
        if (error) throwApiError(error);
        return data as { uploadUrl: string; fileKey: string; publicUrl: string };
    },

    /** Sube un archivo directamente a Cloudflare R2 utilizando la Presigned URL via HTTP PUT. */
    uploadFileToR2: async (uploadUrl: string, file: File): Promise<void> => {
        const response = await fetch(uploadUrl, {
            method: 'PUT',
            headers: {
                'Content-Type': file.type || 'image/webp',
            },
            body: file,
        });
        if (!response.ok) {
            throw new Error(`Error al cargar el archivo a Cloudflare R2 (${response.statusText})`);
        }
    },

    /** Upload product images to Cloudflare R2 Public bucket with Sharp optimization. Returns public CDN URLs. */
    uploadImages: async (files: File[]): Promise<string[]> => {
        if (files.length === 0) return [];
        const apiBase = import.meta.env.VITE_API_URL || 'http://localhost:3000';
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
            const { error } = await (api.api.products as any)['delete-image'].post({ url });
            if (error) console.warn('[R2] Failed to delete orphaned image:', error);
        } catch (err) {
            console.warn('[R2] deleteImage request failed:', err);
        }
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


export { isActiveLabels } from '@shared/constants/labels';
