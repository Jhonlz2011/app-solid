import { createRoute, lazyRouteComponent, redirect, useNavigate } from '@tanstack/solid-router';

const LazyBrandNewRoute = lazyRouteComponent(() => import('@modules/brands/components/BrandNewSheet'));
const LazyBrandEditRoute = lazyRouteComponent(() => import('@modules/brands/components/BrandEditSheet'));

/**
 * Creates deep nested modal routes for Brands.
 */
export const createBrandModals = (parentRoute: any, basePath = '', fallbackRedirect: any = { to: '/brands' }) => {
    const prefix = basePath ? `${basePath}/` : '';
    const segment = basePath || 'brands';
    const fallbackPath = typeof fallbackRedirect === 'string' ? fallbackRedirect : (fallbackRedirect.to || '/brands');

    const getBackTarget = () => {
        const path = window.location.pathname;
        const marker = `/${segment}`;
        const index = path.lastIndexOf(marker);
        if (index !== -1) {
            const target = path.substring(0, index);
            return target || fallbackPath;
        }
        return '..';
    };

    const newRoute = createRoute({
        getParentRoute: () => parentRoute,
        path: `${prefix}new`,
        beforeLoad: async () => {
            const { useAuth } = await import('@modules/auth/store/auth.store');
            if (!useAuth().canAdd('brands')) {
                throw redirect(fallbackRedirect);
            }
        },
        component: function NestedBrandNewWrapper() {
            const navigate = useNavigate();
            return (
                <LazyBrandNewRoute 
                    onClose={() => navigate({ to: getBackTarget(), search: true })} 
                />
            );
        },
    });

    const baseRoute = createRoute({
        getParentRoute: () => parentRoute,
        path: `${prefix}$brandId`,
    });

    const indexRoute = createRoute({
        getParentRoute: () => baseRoute,
        path: `/`,
        beforeLoad: () => { throw redirect(fallbackRedirect); }
    });

    const editRoute = createRoute({
        getParentRoute: () => baseRoute,
        path: `edit`,
        beforeLoad: async () => {
            const { useAuth } = await import('@modules/auth/store/auth.store');
            if (!useAuth().canEdit('brands')) {
                throw redirect(fallbackRedirect);
            }
        },
        component: function NestedBrandEditWrapper() {
            const navigate = useNavigate();
            return (
                <LazyBrandEditRoute 
                    onClose={() => navigate({ to: getBackTarget(), search: true })} 
                />
            );
        },
    });

    return [
        newRoute,
        baseRoute.addChildren([
            indexRoute,
            editRoute,
        ])
    ];
};
