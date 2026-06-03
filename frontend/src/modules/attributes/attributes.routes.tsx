import { createRoute, redirect, lazyRouteComponent } from '@tanstack/solid-router';
import { queryClient } from '@shared/lib/queryClient';
import GlobalPageLoader from '@shared/ui/GlobalPageLoader';
import { createAttributeModals } from '@shared/routes/attributes.factory';
import { attributesApi } from './data/attributes.api';
import { attributeKeys } from './data/attributes.keys';

const AttributesPage = lazyRouteComponent(() => import('./views/AttributesPage'));

export const createAttributesRoutes = (layoutRoute: any) => {
    const attributesRoute = createRoute({
        getParentRoute: () => layoutRoute,
        path: 'attributes',
        beforeLoad: async () => {
            const { useAuth } = await import('@modules/auth/store/auth.store');
            if (!useAuth().canRead('attributes')) {
                throw redirect({ to: '/dashboard' });
            }
        },
        loader: async () => {
            await queryClient.prefetchQuery({
                queryKey: attributeKeys.all,
                queryFn: () => attributesApi.list(),
                staleTime: 1000 * 60 * 30,
            });
        },
        pendingComponent: GlobalPageLoader,
        component: AttributesPage,
    });

    attributesRoute.addChildren([
        ...createAttributeModals(attributesRoute),
    ]);

    return attributesRoute;
};
