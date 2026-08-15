import { lazyRouteComponent } from '@tanstack/solid-router';
import { createEntityModals } from '@shared/routes/modals.factory';
import { locationKeys } from '@modules/locations/data/locations.keys';
import { locationsApi } from '@modules/locations/data/locations.api';

const LazyLocationShowRoute = lazyRouteComponent(() => import('@modules/locations/components/LocationShowPanel'));
const LazyLocationEditRoute = lazyRouteComponent(() => import('@modules/locations/components/LocationEditSheet'));
const LazyLocationNewRoute = lazyRouteComponent(() => import('@modules/locations/components/LocationNewSheet'));

export const createLocationModals = (parentRoute: any, basePath = '') =>
    createEntityModals(parentRoute, basePath, {
        entityKey: 'locations',
        idParam: 'locationId',
        components: { New: LazyLocationNewRoute, Show: LazyLocationShowRoute, Edit: LazyLocationEditRoute },
        detail: { queryKey: locationKeys.detail, queryFn: locationsApi.get },
        allowShowFromNew: true,
    });
