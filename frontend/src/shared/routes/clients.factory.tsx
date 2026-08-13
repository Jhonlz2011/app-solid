import { lazyRouteComponent } from '@tanstack/solid-router';
import { createEntityModals } from '@shared/routes/modals.factory';
import { clientKeys } from '@modules/clients/data/clients.keys';
import { clientsApi } from '@modules/clients/data/clients.api';

const LazyClientShowRoute = lazyRouteComponent(() => import('@modules/clients/components/ClientShowPanel'));
const LazyClientEditRoute = lazyRouteComponent(() => import('@modules/clients/components/ClientEditSheet'));
const LazyClientNewRoute = lazyRouteComponent(() => import('@modules/clients/components/ClientNewSheet'));

export const createClientsModals = (parentRoute: any, basePath = '') =>
    createEntityModals(parentRoute, basePath, {
        entityKey: 'clients',
        idParam: 'clientId',
        components: { New: LazyClientNewRoute, Show: LazyClientShowRoute, Edit: LazyClientEditRoute },
        detail: { queryKey: clientKeys.detail, queryFn: clientsApi.get },
    });
