import { createQuery } from '@tanstack/solid-query';
import { STALE_TIME, GC_TIME } from '@shared/constants/cache.constants';
import { brandingApi } from './branding.api';
import { brandingKeys } from './branding.keys';

export function useCompanyBranding() {
    return createQuery(() => ({
        queryKey: brandingKeys.branding,
        queryFn: () => brandingApi.get(),
        staleTime: STALE_TIME.LONG,
        gcTime: GC_TIME.DEFAULT,
    }));
}
