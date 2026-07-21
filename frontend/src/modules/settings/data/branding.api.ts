import { api } from '@shared/lib/eden';
import { throwApiError } from '@shared/utils/api-errors';
import type { CompanySettingsFormData } from '@app/schema/frontend';

/**
 * Branding API wrappers.
 *
 * NOTE on `as any`: Eden treaty cannot resolve hyphenated route segments
 * (e.g. 'upload-logo') as JS property accessors. This is a known Eden limitation.
 * The `as any` casts are scoped to the minimal accessor chain and the return
 * types are explicitly annotated to preserve end-to-end type safety.
 */
export const brandingApi = {
    get: async (): Promise<CompanySettingsFormData> => {
        const { data, error } = await api.api.settings.company.get();
        if (error) throwApiError(error);
        return data as CompanySettingsFormData;
    },

    uploadLogo: async (file: File): Promise<string> => {
        // Eden can't resolve 'upload-logo' (hyphenated segment)
        const { data, error } = await (api.api.settings.company as any)['upload-logo'].post({
            file,
        });
        if (error) throwApiError(error);
        return (data as { url: string }).url;
    },

    uploadLoginBg: async (file: File, cropData?: { x: number; y: number; width: number; height: number }): Promise<string> => {
        // Eden can't resolve 'upload-bg' (hyphenated segment)
        const body: any = { file };
        if (cropData) {
            body.cropX = String(cropData.x);
            body.cropY = String(cropData.y);
            body.cropWidth = String(cropData.width);
            body.cropHeight = String(cropData.height);
        }
        const { data, error } = await (api.api.settings.company as any)['upload-bg'].post(body);
        if (error) throwApiError(error);
        return (data as { url: string }).url;
    },

    update: async (body: CompanySettingsFormData, loginBgCrop?: { x: number; y: number; width: number; height: number }): Promise<CompanySettingsFormData> => {
        // Upload files first if present
        let logoUrl = body.logoUrl;
        if (body.logoUrl instanceof File) {
            logoUrl = await brandingApi.uploadLogo(body.logoUrl);
        }

        let loginBgUrl = body.loginBgUrl;
        if (body.loginBgUrl instanceof File) {
            loginBgUrl = await brandingApi.uploadLoginBg(body.loginBgUrl, loginBgCrop);
        }

        const finalBody = {
            ...body,
            logoUrl,
            loginBgUrl,
        };

        // Eden can't infer PATCH method on nested routes
        const { data, error } = await (api.api.settings.company as any).patch(finalBody);
        if (error) throwApiError(error);
        return data as CompanySettingsFormData;
    }
};
