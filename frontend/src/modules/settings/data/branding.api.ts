import { api } from '@shared/lib/eden';
import { throwApiError } from '@shared/utils/api-errors';
import type { CompanySettingsFormData } from '@app/schema/frontend';
import type { CropCoordinates } from '@app/schema';

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

    uploadLoginBg: async (file: File, cropData?: CropCoordinates): Promise<string> => {
        // Eden can't resolve 'upload-bg' (hyphenated segment)
        const body: Record<string, unknown> = { file };
        if (cropData) {
            body.cropX = cropData.x;
            body.cropY = cropData.y;
            body.cropWidth = cropData.width;
            body.cropHeight = cropData.height;
            if (cropData.rotate) body.cropRotate = cropData.rotate;
            if (cropData.flipX) body.cropFlipX = cropData.flipX;
            if (cropData.flipY) body.cropFlipY = cropData.flipY;
        }
        const { data, error } = await (api.api.settings.company as any)['upload-bg'].post(body);
        if (error) throwApiError(error);
        return (data as { url: string }).url;
    },

    update: async (body: CompanySettingsFormData, loginBgCrop?: CropCoordinates): Promise<CompanySettingsFormData> => {
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
