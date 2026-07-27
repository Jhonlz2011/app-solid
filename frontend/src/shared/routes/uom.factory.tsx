import { createRoute, lazyRouteComponent, redirect, useNavigate } from '@tanstack/solid-router';

const LazyUomNewRoute = lazyRouteComponent(() => import('@modules/uom/components/UomNewSheet'));
const LazyUomEditRoute = lazyRouteComponent(() => import('@modules/uom/components/UomEditSheet'));

/**
 * Creates deep nested modal routes for UOM.
 */
export const createUomModals = (parentRoute: any, basePath = '', fallbackRedirect: any = { to: '/uom' }) => {
    const prefix = basePath ? `${basePath}/` : '';
    const segment = basePath || 'uom';
    const fallbackPath = typeof fallbackRedirect === 'string' ? fallbackRedirect : (fallbackRedirect.to || '/uom');

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
            if (!useAuth().canAdd('uom')) {
                throw redirect(fallbackRedirect);
            }
        },
        component: function NestedUomNewWrapper() {
            const navigate = useNavigate();
            return (
                <LazyUomNewRoute 
                    onClose={() => navigate({ to: getBackTarget(), search: true })} 
                />
            );
        },
    });

    const baseRoute = createRoute({
        getParentRoute: () => parentRoute,
        path: `${prefix}$uomId`,
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
            if (!useAuth().canEdit('uom')) {
                throw redirect(fallbackRedirect);
            }
        },
        component: function NestedUomEditWrapper() {
            const navigate = useNavigate();
            return (
                <LazyUomEditRoute 
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
