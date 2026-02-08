import { lazy, Component } from 'solid-js';
import { createRoute, redirect } from '@tanstack/solid-router';
import AuthLayout from '@layout/AuthLayout';

const Login = lazy(() => import('./pages/Login')) as Component;

export const createAuthRoutes = (rootRoute: any) => {
    const authRoute = createRoute({
        getParentRoute: () => rootRoute,
        id: 'auth-layout',
        beforeLoad: async () => {
            // Redirect to dashboard if already authenticated
            const { useAuth } = await import('./store/auth.store');
            const auth = useAuth();
            if (auth.isAuthenticated()) {
                throw redirect({ to: '/dashboard' });
            }
        },
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