import { lazyRouteComponent } from '@tanstack/solid-router';
import { createEntityModals } from '@shared/routes/modals.factory';
import { createAttributeModals } from '@shared/routes/attributes.factory';
import { categoryKeys } from '@modules/categories/data/categories.keys';
import { categoriesApi } from '@modules/categories/data/categories.api';

const LazyCategoryNewRoute = lazyRouteComponent(() => import('@modules/categories/components/CategoryNewSheet'));
const LazyCategoryShowRoute = lazyRouteComponent(() => import('@modules/categories/components/CategoryShowPanel'));
const LazyCategoryEditRoute = lazyRouteComponent(() => import('@modules/categories/components/CategoryEditSheet'));

export const createCategoryModals = (parentRoute: any, basePath = '') =>
    createEntityModals(parentRoute, basePath, {
        entityKey: 'categories',
        idParam: 'categoryId',
        components: { New: LazyCategoryNewRoute, Show: LazyCategoryShowRoute, Edit: LazyCategoryEditRoute },
        detail: { queryKey: categorieKeys.categoryDetail, queryFn: categoriesApi.getCategory },
        allowShowFromNew: true,
        nestInNew: (newRoute) => createAttributeModals(newRoute, 'attributes'),
        nestInEdit: (editRoute) => createAttributeModals(editRoute, 'attributes'),
    });