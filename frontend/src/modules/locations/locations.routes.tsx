import { createRoute, lazyRouteComponent } from '@tanstack/solid-router';
import { queryClient } from '@shared/lib/queryClient';
import GlobalPageLoader from '@shared/ui/GlobalPageLoader';
import { createLocationModals } from '@shared/routes/locations.factory';
import { locationsApi } from './data/locations.api';
import { locationKeys } from './data/locations.keys';

const LocationPage = lazyRouteComponent(() => import('./views/LocationPage'));

export const createLocationRoutes = (layoutRoute: any) => {
    const locationsRoute = createRoute({
        getParentRoute: () => layoutRoute,
        path: 'locations',
        loader: async () => {
            await queryClient.prefetchQuery({
                queryKey: locationKeys.all,
                queryFn: () => locationsApi.list(),
                staleTime: 1000 * 60 * 30,
            });
        },
        pendingComponent: GlobalPageLoader,
        component: LocationPage,
    });

    locationsRoute.addChildren([
        ...createLocationModals(locationsRoute),
    ]);

    return locationsRoute;
};
