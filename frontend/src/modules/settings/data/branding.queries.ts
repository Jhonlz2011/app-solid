import { createQuery } from '@tanstack/solid-query';
import { brandingApi } from './branding.api';
import { brandingKeys } from './branding.keys';

export function useCompanyBranding() {
    return createQuery(() => ({
        queryKey: brandingKeys.branding,
        queryFn: () => brandingApi.get(),
        staleTime: 1000 * 60 * 10, // 10 minutos
        gcTime: 1000 * 60 * 60, // 1 hora
    }));
}
