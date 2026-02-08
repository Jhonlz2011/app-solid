// products/data/products.queries.ts
// TanStack Query options and mutations
import { queryOptions } from '@tanstack/solid-query';
import { productsApi } from './products.api';
import { productKeys, categoryKeys, brandKeys, catalogKeys } from './products.keys';
import type { ProductFilters } from '../models/products.types';

// Query Options - use with createQuery(() => productQueries.list(filters))
export const productQueries = {
    list: (filters?: ProductFilters) => queryOptions({
        queryKey: productKeys.list(filters),
        queryFn: () => productsApi.list(filters),
        staleTime: 1000 * 60 * 2, // 2 minutes
    }),

    detail: (id: number) => queryOptions({
        queryKey: productKeys.detail(id),
        queryFn: () => productsApi.get(id),
        staleTime: 1000 * 60 * 5, // 5 minutes
    }),
};

export const categoryQueries = {
    list: () => queryOptions({
        queryKey: categoryKeys.list(),
        queryFn: () => productsApi.listCategories(),
        staleTime: 1000 * 60 * 10, // 10 minutes
    }),

    detail: (id: number) => queryOptions({
        queryKey: categoryKeys.detail(id),
        queryFn: () => productsApi.getCategoryWithAttributes(id),
    }),
};

export const brandQueries = {
    list: () => queryOptions({
        queryKey: brandKeys.list(),
        queryFn: () => productsApi.listBrands(),
        staleTime: 1000 * 60 * 10,
    }),
};

export const catalogQueries = {
    uom: () => queryOptions({
        queryKey: catalogKeys.uom,
        queryFn: () => productsApi.listUoms(),
        staleTime: 1000 * 60 * 30, // 30 minutes - rarely changes
    }),

    attributes: () => queryOptions({
        queryKey: catalogKeys.attributes,
        queryFn: () => productsApi.listAttributes(),
        staleTime: 1000 * 60 * 30,
    }),
};

// Re-export API for mutations (mutations don't use queryOptions)
export { productsApi };
