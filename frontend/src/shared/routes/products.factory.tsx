import { lazyRouteComponent } from '@tanstack/solid-router';
import { createEntityModals } from '@shared/routes/modals.factory';
import { createCategoryModals } from '@/shared/routes/categories.factory';
import { createBrandModals } from '@shared/routes/brands.factory';
import { productKeys, productsApi } from '@modules/products/data/products.api';

const LazyProductShowRoute = lazyRouteComponent(() => import('@modules/products/components/ProductShowPanel'));
const LazyProductEditRoute = lazyRouteComponent(() => import('@modules/products/components/ProductEditSheet'));
const LazyProductNewRoute = lazyRouteComponent(() => import('@modules/products/components/ProductNewSheet'));

export const createProductModals = (parentRoute: any, basePath = '') =>
    createEntityModals(parentRoute, basePath, {
        entityKey: 'products',
        idParam: 'productId',
        components: { New: LazyProductNewRoute, Show: LazyProductShowRoute, Edit: LazyProductEditRoute },
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
