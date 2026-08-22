import { createRoute, redirect, lazyRouteComponent } from '@tanstack/solid-router';
import AuthLayout from '@layout/AuthLayout';
import Login from './pages/Login';

export const createAuthRoutes = (rootRoute: any) => {
    const authRoute = createRoute({
        getParentRoute: () => rootRoute,
        id: 'auth-layout',
        beforeLoad: async () => {
            const { actions, useAuth } = await import('./store/auth.store');
            const { isGlobalPortalHost, buildTenantUrl } = await import('@app/schema/utils');
            const auth = useAuth();

            const handleAuthenticatedRedirect = (user: any) => {
                const isGlobal = isGlobalPortalHost(window.location.hostname);
                if (isGlobal && user?.companySlug) {
                    window.location.href = buildTenantUrl(user.companySlug, '/dashboard', { queryParams: { session: 'true' } });
                    return;
                }
                throw redirect({ to: '/dashboard' });
            };

            // Fast path: already authenticated in memory → redirect immediately
            if (auth.isAuthenticated()) {
                handleAuthenticatedRedirect(auth.user());
            }
            // Fast path: no session flag → show login instantly (zero API calls)
            if (!localStorage.getItem('hasSession')) {
                return;
            }

            // Session flag exists but state not initialized (page refresh) → validate with server
            const restored = await actions.initSession();
            if (restored) {
                handleAuthenticatedRedirect(auth.user());
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

    const registerRoute = createRoute({
        getParentRoute: () => authRoute,
        path: 'register',
        component: lazyRouteComponent(() => import('./pages/Register')),
    });

    return authRoute.addChildren([loginRoute, registerRoute]);
};