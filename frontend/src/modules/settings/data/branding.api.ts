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
        const apiBase = import.meta.env.VITE_API_URL || 'http://localhost:3000';
        const formData = new FormData();
        formData.append('file', file);
        const res = await fetch(`${apiBase}/api/settings/company/upload-logo`, {
            method: 'POST',
            body: formData,
            credentials: 'include',
        });
        if (!res.ok) {
            const errText = await res.text();
            throw new Error(`Error al subir el logo: ${errText}`);
        }
        const data = await res.json();
        return data.url;
    },

    uploadLoginBg: async (file: File): Promise<string> => {
        const apiBase = import.meta.env.VITE_API_URL || 'http://localhost:3000';
        const formData = new FormData();
        formData.append('file', file);
        const res = await fetch(`${apiBase}/api/settings/company/upload-bg`, {
            method: 'POST',
            body: formData,
            credentials: 'include',
        });
        if (!res.ok) {
            const errText = await res.text();
            throw new Error(`Error al subir el fondo de pantalla: ${errText}`);
        }
        const data = await res.json();
        return data.url;
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
