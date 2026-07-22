import { createMutation, useQueryClient } from '@tanstack/solid-query';
import { brandingApi } from './branding.api';
import { brandingKeys } from './branding.keys';
import type { CompanySettingsFormData } from '@app/schema/frontend';
import type { CropCoordinates } from '@app/schema';
import { applyBranding, getSubdomain } from '@modules/auth/store/branding.store';
import { toast } from 'solid-sonner';

/**
 * Optimistic mutation for settings branding updates.
 * 
 * Flow:
 * 1. onMutate: Instantly update cache + apply branding CSS (0ms UX)
 * 2. Server processes the PATCH request
 * 3. onSuccess: Sync with real server response (R2 URLs, etc.)
 * 4. onError: Rollback to previous state
 */
export function useUpdateSettingsBranding() {
    const qc = useQueryClient();
    
    return createMutation(() => ({
        mutationKey: ['settings', 'branding', 'update'],
        mutationFn: (variables: { body: CompanySettingsFormData; loginBgCrop?: CropCoordinates }) => brandingApi.update(variables.body, variables.loginBgCrop),

        // 🚀 Optimistic update — instant UX before server responds
        onMutate: async (variables) => {
            const newData = variables.body;
            // Cancel in-flight queries to prevent stale overwrites
            await qc.cancelQueries({ queryKey: brandingKeys.branding });

            // Snapshot previous state for rollback
            const previousData = qc.getQueryData<any>(brandingKeys.branding);

            // Update TanStack Query cache optimistically
            qc.setQueryData(brandingKeys.branding, (old: any) => ({
                ...old,
                ...newData,
                // Preserve URL strings for File objects (real URLs come from onSuccess)
                logoUrl: newData.logoUrl instanceof File ? old?.logoUrl : newData.logoUrl,
                loginBgUrl: newData.loginBgUrl instanceof File ? old?.loginBgUrl : newData.loginBgUrl,
            }));

            // Apply branding CSS variables IMMEDIATELY (0ms perceived latency)
            const slug = previousData?.slug || getSubdomain() || '';
            const id = previousData?.id || 0;
            applyBranding({
                id, slug,
                businessName: newData.businessName,
                tradeName: newData.tradeName,
                logoUrl: typeof newData.logoUrl === 'string' ? newData.logoUrl : previousData?.logoUrl ?? null,
                primaryColor: newData.primaryColor,
                themeColor: newData.themeColor,
                loginBgUrl: typeof newData.loginBgUrl === 'string' ? newData.loginBgUrl : previousData?.loginBgUrl ?? null,
            });

            return { previousData };
        },

        // ❌ Rollback on server error
        onError: (_err, _newData, context) => {
            if (context?.previousData) {
                qc.setQueryData(brandingKeys.branding, context.previousData);
                applyBranding(context.previousData);
            }
            toast.error('Error al guardar los cambios');
        },

        // ✅ Sync with real server response (includes R2 URLs for uploaded files)
        onSuccess: (data: any) => {
            qc.setQueryData(brandingKeys.branding, data);

            const slug = data.slug || getSubdomain() || '';
            const id = data.id || 0;

            const tenantObj = {
                id, slug,
                businessName: data.businessName,
                tradeName: data.tradeName,
                logoUrl: data.logoUrl,
                primaryColor: data.primaryColor,
                themeColor: data.themeColor,
                loginBgUrl: data.loginBgUrl,
            };

            // Persist to localStorage for branding-fallback.js on next page load
            if (slug) {
                localStorage.setItem(`branding:${slug}`, JSON.stringify(tenantObj));
            }

            // Re-apply with real R2 URLs (in case files were uploaded)
            applyBranding(tenantObj);

            // Invalidate to ensure fresh data on next read
            qc.invalidateQueries({ queryKey: brandingKeys.branding });
        },
    }));
}
