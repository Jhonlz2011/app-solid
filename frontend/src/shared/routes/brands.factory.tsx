import { lazyRouteComponent } from '@tanstack/solid-router';
import { createEntityModals } from '@shared/routes/modals.factory';

const LazyBrandNewRoute = lazyRouteComponent(() => import('@modules/brands/components/BrandNewSheet'));
const LazyBrandEditRoute = lazyRouteComponent(() => import('@modules/brands/components/BrandEditSheet'));

export const createBrandModals = (parentRoute: any, basePath = '') =>
    createEntityModals(parentRoute, basePath, {
        entityKey: 'brands',
        idParam: 'brandId',
        components: { New: LazyBrandNewRoute, Edit: LazyBrandEditRoute },
    });
