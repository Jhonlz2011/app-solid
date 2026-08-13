import { lazyRouteComponent } from '@tanstack/solid-router';
import { createEntityModals } from '@shared/routes/modals.factory';

const LazyWarehouseNewRoute = lazyRouteComponent(() => import('@modules/settings/components/warehouses/WarehouseNewSheet'));
const LazyWarehouseEditRoute = lazyRouteComponent(() => import('@modules/settings/components/warehouses/WarehouseEditSheet'));

export const createWarehouseModals = (parentRoute: any, basePath = '') =>
    createEntityModals(parentRoute, basePath, {
        entityKey: 'inventory',
        idParam: 'warehouseId',
        components: { New: LazyWarehouseNewRoute, Edit: LazyWarehouseEditRoute },
    });
