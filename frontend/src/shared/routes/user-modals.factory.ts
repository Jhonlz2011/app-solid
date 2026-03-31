import { createRoute, lazyRouteComponent, redirect } from '@tanstack/solid-router';
import { queryClient } from '@shared/lib/queryClient';
import { rbacKeys } from '@modules/users/data/users.keys';
import { usersApi } from '@modules/users/data/users.api';

// Lazy loading the Panels as Route Components
const LazyUserShowRoute = lazyRouteComponent(() => import('@modules/users/components/UserShowPanel'));
const LazyUserEditRoute = lazyRouteComponent(() => import('@modules/users/components/UserEditSheet'));
const LazyUserNewRoute = lazyRouteComponent(() => import('@modules/users/components/UserNewSheet'));

/**
 * Creates the modal routes for the Users module to be injected via Deep Nesting.
 * By deep-nesting `/edit` inside `/$userId`, the Edit Modal renders *over* the Show Panel.
 * 
 * @param parentRoute The route this factory will be attached to (e.g. usersRoute or clientsRoute)
 * @param basePath The base path to attach these routes to (defaults to '')
 */
export const createUserModals = (parentRoute: any, basePath = '', fallbackRedirect = '/users') => {
    
    const prefix = basePath ? `${basePath}/` : '';

    // --- CREATE / NEW USER ---
    const newRoute = createRoute({
        getParentRoute: () => parentRoute,
        path: `${prefix}new`,
        component: LazyUserNewRoute,
    });

    // --- BASE USER LAYOUT WRAPPER (/users/$userId) ---
    // Pure structural node, no UI component attached
    const userBaseRoute = createRoute({
        getParentRoute: () => parentRoute,
        path: `${prefix}$userId`,
    });

    // --- INVISIBLE BOUNCE-BACK NODE (/users/$userId -> /users) ---
    // Si alguien llega a `/users/2` (por ejemplo, al dar 'Atrás' desde `/users/2/edit`), lo rebotamos a la tabla principal.
    const userIndexRoute = createRoute({
        getParentRoute: () => userBaseRoute,
        path: `/`,
        beforeLoad: () => { throw redirect({ to: fallbackRedirect }); }
    });

    // --- SHOW USER (/users/$userId/show) ---
    const showRoute = createRoute({
        getParentRoute: () => userBaseRoute,
        path: `show`,
        loader: async ({ params }) => {
            const userId = Number(params.userId);
            if (isNaN(userId)) return;

            return await queryClient.prefetchQuery({
                queryKey: rbacKeys.user(userId),
                queryFn: () => usersApi.getUser(userId),
                staleTime: 1000 * 60 * 5, 
            });
        },
        component: LazyUserShowRoute,
    });

    // --- EDIT USER SIBLING (/users/$userId/edit) (FROM TABLE) ---
    const editRoute = createRoute({
        getParentRoute: () => userBaseRoute,
        path: `edit`,
        loader: async ({ params }) => {
            const userId = Number(params.userId);
            await queryClient.prefetchQuery({ queryKey: rbacKeys.roles(), queryFn: () => usersApi.listRoles(), staleTime: 1000 * 60 * 5 });
            await queryClient.prefetchQuery({ queryKey: rbacKeys.user(userId), queryFn: () => usersApi.getUser(userId), staleTime: 1000 * 60 * 5 });
            return;
        },
        component: LazyUserEditRoute,
    });

    // --- EDIT USER CHILD (/users/$userId/show/edit) (FROM SHOW PANEL) ---
    const nestedEditRoute = createRoute({
        getParentRoute: () => showRoute,
        path: `edit`,
        loader: async ({ params }) => {
            const userId = Number(params.userId);
            await queryClient.prefetchQuery({ queryKey: rbacKeys.roles(), queryFn: () => usersApi.listRoles(), staleTime: 1000 * 60 * 5 });
        },
        component: LazyUserEditRoute,
    });

    // Return the array of configured routes to inject into `addChildren`
    return [
        newRoute,
        userBaseRoute.addChildren([
            userIndexRoute, // Redirecciona a la tabla principal
            showRoute.addChildren([nestedEditRoute]), // Comportamiento Hijo
            editRoute // Comportamiento Hermano
        ])
    ];
};
