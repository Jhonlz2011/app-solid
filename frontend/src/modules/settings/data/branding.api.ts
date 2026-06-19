import { api } from '@shared/lib/eden';
import { throwApiError } from '@shared/utils/api-errors';
import type { CompanySettingsFormData } from '@app/schema/frontend';

export const brandingApi = {
    get: async (): Promise<CompanySettingsFormData> => {
        const { data, error } = await api.api.settings.company.get();
        if (error) throwApiError(error);
        return data as CompanySettingsFormData;
    },

    uploadLogo: async (file: File): Promise<string> => {
        const { data, error } = await (api.api.settings.company as any)['upload-logo'].post({
            file,
        });
        if (error) throwApiError(error);
        return (data as { url: string }).url;
    },

    uploadLoginBg: async (file: File): Promise<string> => {
        const { data, error } = await (api.api.settings.company as any)['upload-bg'].post({
            file,
        });
        if (error) throwApiError(error);
        return (data as { url: string }).url;
    },

    update: async (body: CompanySettingsFormData): Promise<CompanySettingsFormData> => {
        let logoUrl = body.logoUrl;
        if (body.logoUrl instanceof File) {
            logoUrl = await brandingApi.uploadLogo(body.logoUrl);
        }

        let loginBgUrl = body.loginBgUrl;
        if (body.loginBgUrl instanceof File) {
            loginBgUrl = await brandingApi.uploadLoginBg(body.loginBgUrl);
        }

        const finalBody = {
            ...body,
            logoUrl,
            loginBgUrl,
        };

        const { data, error } = await (api.api.settings.company as any).patch(finalBody);
        if (error) throwApiError(error);
        return data as CompanySettingsFormData;
    }
};
