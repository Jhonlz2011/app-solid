import { createRoute, lazyRouteComponent } from '@tanstack/solid-router';
import { queryClient } from '@shared/lib/queryClient';
import GlobalPageLoader from '@shared/ui/GlobalPageLoader';
import { createUomModals } from '@shared/routes/uom.factory';
import { uomApi } from './data/uom.api';
import { uomKeys } from './data/uom.keys';

const UomPage = lazyRouteComponent(() => import('./views/UomPage'));

export const createUomRoutes = (layoutRoute: any) => {
    const uomRoute = createRoute({
        getParentRoute: () => layoutRoute,
        path: 'uom',
        loader: async () => {
            await queryClient.prefetchQuery({
                queryKey: uomKeys.all,
                queryFn: () => uomApi.list(),
                staleTime: 1000 * 60 * 30,
            });
        },
        pendingComponent: GlobalPageLoader,
        component: UomPage,
    });

    uomRoute.addChildren([
        ...createUomModals(uomRoute),
    ]);

    return uomRoute;
};