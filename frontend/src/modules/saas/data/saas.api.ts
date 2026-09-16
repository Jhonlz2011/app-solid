import { api } from '@shared/lib/eden';
import { throwApiError } from '@shared/utils/api-errors';
import type { UpgradePlanBodyType } from '@app/schema/backend';

export const saasApi = {
    getPlans: async () => {
        const { data, error } = await api.saas.plans.get();
        if (error) throwApiError(error);
        return data!;
    },

    getAddons: async () => {
        const { data, error } = await api.saas.addons.get();
        if (error) throwApiError(error);
        return data!;
    },

    getDocumentPacks: async () => {
        const { data, error } = await api.saas['document-packs'].get();
        if (error) throwApiError(error);
        return data!;
    },

    getMySubscription: async () => {
        const { data, error } = await api.saas.subscription.me.get();
        if (error) throwApiError(error);
        return data!;
    },

    upgradePlan: async (body: UpgradePlanBodyType) => {
        const { data, error } = await api.saas.subscription.upgrade.post(body);
        if (error) throwApiError(error);
        return data!;
    },
};
