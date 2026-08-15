import { lazyRouteComponent } from '@tanstack/solid-router';
import { createEntityModals } from '@shared/routes/modals.factory';
import { clientKeys } from '@modules/clients/data/clients.keys';
import { clientsApi } from '@modules/clients/data/clients.api';

const LazyEntityShowRoute = lazyRouteComponent(() => import('@modules/entities/components/EntityShowPanel'));
const LazyEntityEditRoute = lazyRouteComponent(() => import('@modules/entities/components/EntityEditSheet'));
const LazyEntityNewRoute = lazyRouteComponent(() => import('@modules/entities/components/EntityNewSheet'));

export const createClientsModals = (parentRoute: any, basePath = '') =>
    createEntityModals(parentRoute, basePath, {
        entityKey: 'clients',
        idParam: 'clientId',
        components: { New: LazyEntityNewRoute, Show: LazyEntityShowRoute, Edit: LazyEntityEditRoute },
        detail: { queryKey: clientKeys.detail, queryFn: clientsApi.get },
    });
