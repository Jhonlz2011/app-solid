import { createRoute, Outlet } from '@tanstack/solid-router';

/**
 * Pathless layout route for CRUD / Entity views.
 *
 * In TanStack Router, a pathless route (`id: '_crud'`) does not prefix URL paths,
 * but allows grouping child routes for shared context, shared boundaries,
 * or layout hierarchy without affecting URLs like `/clients`, `/suppliers`, `/users`.
 */
export const createCrudLayout = (parentRoute: any) => {
    return createRoute({
        getParentRoute: () => parentRoute,
        id: '_crud',
        component: () => <Outlet />,
    });
};
