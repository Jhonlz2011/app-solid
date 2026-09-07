import { lazyRouteComponent } from '@tanstack/solid-router';
import { createEntityModals } from '@shared/routes/modals.factory';
import { supplierKeys } from '@modules/suppliers/data/suppliers.keys';
import { suppliersApi } from '@modules/suppliers/data/suppliers.api';

const LazyEntityShowRoute = lazyRouteComponent(async () => {
    const m = await import('@modules/entities/components/EntityShowPanel');
    return { default: (props: any) => <m.EntityShowPanel {...props} type="supplier" /> };
});
const LazyEntityEditRoute = lazyRouteComponent(async () => {
    const m = await import('@modules/entities/components/EntityEditSheet');
    return { default: (props: any) => <m.EntityEditSheet {...props} type="supplier" /> };
});
const LazyEntityNewRoute = lazyRouteComponent(async () => {
    const m = await import('@modules/entities/components/EntityNewSheet');
    return { default: (props: any) => <m.EntityNewSheet {...props} type="supplier" /> };
});

export const createSupplierModals = (parentRoute: any, basePath = '') =>
    createEntityModals(parentRoute, basePath, {
        entityKey: 'suppliers',
        idParam: 'supplierId',
        components: { New: LazyEntityNewRoute, Show: LazyEntityShowRoute, Edit: LazyEntityEditRoute },
        detail: { queryKey: supplierKeys.detail, queryFn: suppliersApi.get },
    });