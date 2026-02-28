import { createRoute, redirect, lazyRouteComponent } from '@tanstack/solid-router';
import AuthLayout from '@layout/AuthLayout';

const Login = lazyRouteComponent(() => import('./pages/Login'));

export const createAuthRoutes = (rootRoute: any) => {
    const authRoute = createRoute({
        getParentRoute: () => rootRoute,
        id: 'auth-layout',
        beforeLoad: async () => {
            const { actions, useAuth } = await import('./store/auth.store');
            const auth = useAuth();
            // Fast path: already authenticated in memory → redirect immediately
            if (auth.isAuthenticated()) {
                throw redirect({ to: '/dashboard' });
            }
            // Fast path: no session flag → show login instantly (zero API calls)
            if (!localStorage.getItem('hasSession')) {
                return;
            }

            // Session flag exists but state not initialized (page refresh) → validate with server
            const restored = await actions.initSession();
            if (restored) {
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