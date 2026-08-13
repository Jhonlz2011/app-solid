import { lazyRouteComponent } from '@tanstack/solid-router';
import { createEntityModals } from '@shared/routes/modals.factory';
import { createCategoryModals } from '@/shared/routes/categories.factory';
import { createBrandModals } from '@shared/routes/brands.factory';
import { productKeys, productsApi } from '@modules/products/data/products.api';

const LazyServiceShowRoute = lazyRouteComponent(() => import('@modules/services/components/ServiceShowPanel'));
const LazyServiceEditRoute = lazyRouteComponent(() => import('@modules/services/components/ServiceEditSheet'));
const LazyServiceNewRoute = lazyRouteComponent(() => import('@modules/services/components/ServiceNewSheet'));

export const createServiceModals = (parentRoute: any, basePath = '') =>
    createEntityModals(parentRoute, basePath, {
        entityKey: 'services',
        idParam: 'serviceId',
        components: { New: LazyServiceNewRoute, Show: LazyServiceShowRoute, Edit: LazyServiceEditRoute },
        detail: { queryKey: productKeys.detail, queryFn: productsApi.get },
        nestInNew: (newRoute) => [
            ...createCategoryModals(newRoute, 'categories'),
            ...createBrandModals(newRoute, 'brands'),
        ],
        nestInEdit: (editRoute) => [
            ...createCategoryModals(editRoute, 'categories'),
            ...createBrandModals(editRoute, 'brands'),
        ],
    });
