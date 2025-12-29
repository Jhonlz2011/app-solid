import { lazy, Component } from 'solid-js';
import { createRoute } from '@tanstack/solid-router';
import AuthLayout from '@layout/AuthLayout';

const Login = lazy(() => import('./views/Login')) as Component;

export const createAuthRoutes = (rootRoute: any) => {
    const authRoute = createRoute({
        getParentRoute: () => rootRoute,
        id: 'auth-layout',
        component: AuthLayout,
    });

    const loginRoute = createRoute({
        getParentRoute: () => authRoute,
        path: 'login',
        validateSearch: (search: Record<string, unknown>) => {
            return {
                redirect: (search.redirect as string) || undefined,
            };
        },
        component: Login,
    });

    return authRoute.addChildren([loginRoute]);
};
