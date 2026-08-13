import { lazyRouteComponent } from '@tanstack/solid-router';
import { createEntityModals } from '@shared/routes/modals.factory';
import { supplierKeys } from '@modules/suppliers/data/suppliers.keys';
import { suppliersApi } from '@modules/suppliers/data/suppliers.api';

const LazySupplierShowRoute = lazyRouteComponent(() => import('@modules/suppliers/components/SupplierShowPanel'));
const LazySupplierEditRoute = lazyRouteComponent(() => import('@modules/suppliers/components/SupplierEditSheet'));
const LazySupplierNewRoute = lazyRouteComponent(() => import('@modules/suppliers/components/SupplierNewSheet'));

export const createSupplierModals = (parentRoute: any, basePath = '') =>
    createEntityModals(parentRoute, basePath, {
        entityKey: 'suppliers',
        idParam: 'supplierId',
        components: { New: LazySupplierNewRoute, Show: LazySupplierShowRoute, Edit: LazySupplierEditRoute },
        detail: { queryKey: supplierKeys.detail, queryFn: suppliersApi.get },
    });