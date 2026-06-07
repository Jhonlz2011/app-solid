import { createMutation, useQueryClient } from '@tanstack/solid-query';
import { brandingApi } from './branding.api';
import { brandingKeys } from './branding.keys';
import type { CompanySettingsFormData } from '@app/schema/frontend';
import { applyBranding, getSubdomain } from '@modules/auth/store/branding.store';

export function useUpdateCompanyBranding() {
    const qc = useQueryClient();
    
    return createMutation(() => ({
        mutationKey: ['settings', 'branding', 'update'],
        mutationFn: (body: CompanySettingsFormData) => brandingApi.update(body),
        onSuccess: (data: any) => {
            // Actualizar la caché de TanStack Query
            qc.setQueryData(brandingKeys.branding, data);
            
            // Obtener el slug y el id actualizados (o recurrir a valores calculados)
            const currentQueryData = qc.getQueryData<any>(brandingKeys.branding);
            const slug = data.slug || currentQueryData?.slug || getSubdomain() || '';
            const id = data.id || currentQueryData?.id || 0;

            const tenantObj = {
                id,
                slug,
                businessName: data.businessName,
                tradeName: data.tradeName,
                logoUrl: data.logoUrl,
                primaryColor: data.primaryColor,
                secondaryColor: data.secondaryColor,
                loginBgUrl: data.loginBgUrl,
            };

            // Sincronizar en localStorage para que persista al recargar la página
            if (slug) {
                localStorage.setItem(`branding:${slug}`, JSON.stringify(tenantObj));
            }
            
            // Aplicar en caliente los cambios de branding y color en la UI
            applyBranding(tenantObj);
        },
        onSettled: () => {
            qc.invalidateQueries({ queryKey: brandingKeys.branding });
        },
    }));
}
