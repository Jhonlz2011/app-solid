import { lazyRouteComponent } from '@tanstack/solid-router';
import { createEntityModals } from '@shared/routes/modals.factory';
import { attributeKeys } from '@modules/attributes/data/attributes.keys';
import { attributesApi } from '@modules/attributes/data/attributes.api';

const LazyAttributeNewRoute = lazyRouteComponent(() => import('@modules/attributes/components/AttributeNewSheet'));
const LazyAttributeShowRoute = lazyRouteComponent(() => import('@modules/attributes/components/AttributeShowPanel'));
const LazyAttributeEditRoute = lazyRouteComponent(() => import('@modules/attributes/components/AttributeEditSheet'));

export const createAttributeModals = (parentRoute: any, basePath = '') =>
    createEntityModals(parentRoute, basePath, {
        entityKey: 'attributes',
        idParam: 'attributeId',
        components: { New: LazyAttributeNewRoute, Show: LazyAttributeShowRoute, Edit: LazyAttributeEditRoute },
        detail: { queryKey: attributeKeys.detail, queryFn: attributesApi.get },
    });
