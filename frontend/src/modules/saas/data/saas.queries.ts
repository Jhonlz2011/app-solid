import { createQuery, createMutation, useQueryClient } from '@tanstack/solid-query';
import { saasApi } from './saas.api';
import type { UpgradePlanBodyType } from '@app/schema/backend';

export const saasKeys = {
    all: ['saas'] as const,
    plans: () => [...saasKeys.all, 'plans'] as const,
    addons: () => [...saasKeys.all, 'addons'] as const,
    documentPacks: () => [...saasKeys.all, 'document-packs'] as const,
    subscription: () => [...saasKeys.all, 'subscription', 'me'] as const,
};

export function useSaasPlans() {
    return createQuery(() => ({
        queryKey: saasKeys.plans(),
        queryFn: saasApi.getPlans,
        staleTime: 1000 * 60 * 30, // 30 mins
    }));
}

export function useTenantSubscription() {
    return createQuery(() => ({
        queryKey: saasKeys.subscription(),
        queryFn: saasApi.getMySubscription,
        staleTime: 1000 * 60 * 5, // 5 mins
    }));
}

export function useUpgradePlan() {
    const queryClient = useQueryClient();
    return createMutation(() => ({
        mutationFn: (body: UpgradePlanBodyType) => saasApi.upgradePlan(body),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: saasKeys.subscription() });
        },
    }));
}
