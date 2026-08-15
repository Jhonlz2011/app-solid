import { lazyRouteComponent } from '@tanstack/solid-router';
import { createEntityModals } from '@shared/routes/modals.factory';
import { supplierKeys } from '@modules/suppliers/data/suppliers.keys';
import { suppliersApi } from '@modules/suppliers/data/suppliers.api';

const LazyEntityShowRoute = lazyRouteComponent(() => import('@modules/entities/components/EntityShowPanel'));
const LazyEntityEditRoute = lazyRouteComponent(() => import('@modules/entities/components/EntityEditSheet'));
const LazyEntityNewRoute = lazyRouteComponent(() => import('@modules/entities/components/EntityNewSheet'));

export const createSupplierModals = (parentRoute: any, basePath = '') =>
    createEntityModals(parentRoute, basePath, {
        entityKey: 'suppliers',
        idParam: 'supplierId',
        components: { New: LazyEntityNewRoute, Show: LazyEntityShowRoute, Edit: LazyEntityEditRoute },
        detail: { queryKey: supplierKeys.detail, queryFn: suppliersApi.get },
    });