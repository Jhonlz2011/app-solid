import { createQuery } from '@tanstack/solid-query';
import { brandsApi, type BrandItem } from './brands.api';
import { brandKeys } from './brands.keys';

export function useBrandsList() {
    return createQuery(() => ({
        queryKey: brandKeys.all,
        queryFn: () => brandsApi.list() as Promise<BrandItem[]>,
        staleTime: 1000 * 60 * 30,
    }));
}
