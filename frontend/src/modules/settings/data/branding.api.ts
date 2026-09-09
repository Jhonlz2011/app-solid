import { api } from '@shared/lib/eden';
import { throwApiError } from '@shared/utils/api-errors';
import type { CompanySettingsFormData } from '@app/schema/frontend';
import type { CompanySettingsBodyType } from '@app/schema/backend';
import type { CropCoordinates } from '@app/schema/dto';

/**
 * Branding API wrappers.
 */
export const brandingApi = {
    get: async (): Promise<CompanySettingsFormData> => {
        const { data, error } = await api.settings.company.get();
        if (error) throwApiError(error);
        return data as CompanySettingsFormData;
    },

    uploadLogo: async (file: File): Promise<string> => {
        const { data, error } = await api.settings.company['upload-logo'].post({
            file,
        });
        if (error) throwApiError(error);
        return (data as { url: string }).url;
    },

    uploadLoginBg: async (file: File, cropData?: CropCoordinates): Promise<string> => {
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
        const { data, error } = await api.settings.company['upload-bg'].post(body as any);
        if (error) throwApiError(error);
        return (data as { url: string }).url;
    },

    update: async (body: Partial<CompanySettingsFormData>, loginBgCrop?: CropCoordinates): Promise<CompanySettingsFormData> => {
        // Upload files in parallel if present
        const [logoUrl, loginBgUrl] = await Promise.all([
            body.logoUrl instanceof File ? brandingApi.uploadLogo(body.logoUrl) : Promise.resolve(body.logoUrl),
            body.loginBgUrl instanceof File ? brandingApi.uploadLoginBg(body.loginBgUrl, loginBgCrop) : Promise.resolve(body.loginBgUrl),
        ]);

        const finalBody: CompanySettingsBodyType = {
            ...(body as CompanySettingsBodyType),
            ...(logoUrl !== undefined ? { logoUrl: typeof logoUrl === 'string' ? logoUrl : null } : {}),
            ...(loginBgUrl !== undefined ? { loginBgUrl: typeof loginBgUrl === 'string' ? loginBgUrl : null } : {}),
        };

        const { data, error } = await api.settings.company.patch(finalBody);
        if (error) throwApiError(error);
        return data as CompanySettingsFormData;
    },
};
