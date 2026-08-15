import { lazyRouteComponent } from '@tanstack/solid-router';
import { createEntityModals } from '@shared/routes/modals.factory';
import { uomKeys } from '@modules/uom/data/uom.keys';
import { uomApi } from '@modules/uom/data/uom.api';

const LazyUomNewRoute = lazyRouteComponent(() => import('@modules/uom/components/UomNewSheet'));
const LazyUomEditRoute = lazyRouteComponent(() => import('@modules/uom/components/UomEditSheet'));

export const createUomModals = (parentRoute: any, basePath = '') =>
    createEntityModals(parentRoute, basePath, {
        entityKey: 'uom',
        idParam: 'uomId',
        components: { New: LazyUomNewRoute, Edit: LazyUomEditRoute },
        detail: { queryKey: uomKeys.detail, queryFn: uomApi.get },
    });
