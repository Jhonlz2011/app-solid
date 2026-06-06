import { createMutation, useQueryClient } from '@tanstack/solid-query';
import { brandingApi } from './branding.api';
import { brandingKeys } from './branding.keys';
import type { CompanySettingsFormData } from '@app/schema/frontend';
import { applyBranding } from '@modules/auth/store/branding.store';

export function useUpdateCompanyBranding() {
    const qc = useQueryClient();
    
    return createMutation(() => ({
        mutationKey: ['settings', 'branding', 'update'],
        mutationFn: (body: CompanySettingsFormData) => brandingApi.update(body),
        onSuccess: (data) => {
            // Actualizar la caché de TanStack Query
            qc.setQueryData(brandingKeys.branding, data);
            
            // Aplicar en caliente los cambios de branding y color en la UI
            applyBranding({
                id: 0, // Mock id
                slug: '', // Mock slug (se obtiene del hostname)
                businessName: data.businessName,
                tradeName: data.tradeName,
                logoUrl: data.logoUrl,
                primaryColor: data.primaryColor,
                secondaryColor: data.secondaryColor,
                loginBgUrl: data.loginBgUrl,
            });
        },
        onSettled: () => {
            qc.invalidateQueries({ queryKey: brandingKeys.branding });
        },
    }));
}
