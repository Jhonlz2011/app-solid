import { lazyRouteComponent } from '@tanstack/solid-router';
import { createEntityModals } from '@shared/routes/modals.factory';
import { clientKeys } from '@modules/clients/data/clients.keys';
import { clientsApi } from '@modules/clients/data/clients.api';

const LazyEntityShowRoute = lazyRouteComponent(async () => {
    const m = await import('@modules/entities/components/EntityShowPanel');
    return { default: (props: any) => <m.EntityShowPanel {...props} type="client" /> };
});
const LazyEntityEditRoute = lazyRouteComponent(async () => {
    const m = await import('@modules/entities/components/EntityEditSheet');
    return { default: (props: any) => <m.EntityEditSheet {...props} type="client" /> };
});
const LazyEntityNewRoute = lazyRouteComponent(async () => {
    const m = await import('@modules/entities/components/EntityNewSheet');
    return { default: (props: any) => <m.EntityNewSheet {...props} type="client" /> };
});

export const createClientsModals = (parentRoute: any, basePath = '') =>
    createEntityModals(parentRoute, basePath, {
        entityKey: 'clients',
        idParam: 'clientId',
        components: { New: LazyEntityNewRoute, Show: LazyEntityShowRoute, Edit: LazyEntityEditRoute },
        detail: { queryKey: clientKeys.detail, queryFn: clientsApi.get },
    });
