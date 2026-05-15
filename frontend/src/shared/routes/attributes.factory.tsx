import { createRoute, lazyRouteComponent, redirect, useNavigate } from '@tanstack/solid-router';
import { queryClient } from '@shared/lib/queryClient';
import { attributeKeys } from '@modules/attributes/data/attributes.keys';
import { attributesApi } from '@modules/attributes/data/attributes.api';

// --- Lazy Loaders ---
const LazyAttributeShowRoute = lazyRouteComponent(() => import('@modules/attributes/components/AttributeShowPanel'));
const LazyAttributeEditRoute = lazyRouteComponent(() => import('@modules/attributes/components/AttributeEditSheet'));
const LazyAttributeNewRoute = lazyRouteComponent(() => import('@modules/attributes/components/AttributeNewSheet'));

/**
 * Creates deep nested modal routes for Attributes.
 * Pattern: /attributes/new, /attributes/$attributeId/show, /attributes/$attributeId/edit
 */
export const createAttributeModals = (parentRoute: any, basePath = '', fallbackRedirect: any = { to: '/attributes' }) => {
    const prefix = basePath ? `${basePath}/` : '';

    const newRoute = createRoute({
        getParentRoute: () => parentRoute,
        path: `${prefix}new`,
        component: LazyAttributeNewRoute,
    });

    const baseRoute = createRoute({
        getParentRoute: () => parentRoute,
        path: `${prefix}$attributeId`,
    });

    const indexRoute = createRoute({
        getParentRoute: () => baseRoute,
        path: `/`,
        beforeLoad: () => { throw redirect(fallbackRedirect); }
    });

    const showRoute = createRoute({
        getParentRoute: () => baseRoute,
        path: `show`,
        loader: async ({ params }) => {
            const id = Number(params.attributeId);
            if (isNaN(id)) return;
            return await queryClient.prefetchQuery({
                queryKey: attributeKeys.detail(id),
                queryFn: () => attributesApi.get(id),
                staleTime: 1000 * 30,
            });
        },
        component: LazyAttributeShowRoute,
    });

    const editRoute = createRoute({
        getParentRoute: () => baseRoute,
        path: `edit`,
        loader: async ({ params }) => {
            const id = Number(params.attributeId);
            if (isNaN(id)) return;
            await queryClient.prefetchQuery({
                queryKey: attributeKeys.detail(id),
                queryFn: () => attributesApi.get(id),
                staleTime: 1000 * 30,
            });
            return;
        },
        component: LazyAttributeEditRoute,
    });

    const nestedEditRoute = createRoute({
        getParentRoute: () => showRoute,
        path: `edit`,
        component: function NestedEditWrapper() {
            const navigate = useNavigate();
            return <LazyAttributeEditRoute onBack={() => navigate({ to: '..', search: true })} />;
        }
    });

    return [
        newRoute,
        baseRoute.addChildren([
            indexRoute,
            showRoute.addChildren([nestedEditRoute]),
            editRoute
        ])
    ];
};
