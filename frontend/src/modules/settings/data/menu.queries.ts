import { createQuery } from '@tanstack/solid-query';
import { STALE_TIME, GC_TIME } from '@shared/constants/cache.constants';
import { menuApi } from './menu.api';
import { menuKeys } from './menu.keys';

export function useTenantMenuItems() {
    return createQuery(() => ({
        queryKey: menuKeys.list(),
        queryFn: () => menuApi.list(),
        staleTime: STALE_TIME.MEDIUM,
        gcTime: GC_TIME.DEFAULT,
    }));
}
