import { createRoute, redirect, lazyRouteComponent } from '@tanstack/solid-router';
import AuthLayout from '@layout/AuthLayout';
import Login from './pages/Login';

export const createAuthRoutes = (rootRoute: any) => {
    const authRoute = createRoute({
        getParentRoute: () => rootRoute,
        id: 'auth-layout',
        beforeLoad: async ({ location }) => {
            const { actions } = await import('./store/auth.store');
            const user = await actions.ensureSession();
            if (!user) return; // Unauthenticated -> allow rendering auth pages

            // If an authenticated user with an existing company visits /register, route to /create-company
            if (location.pathname.includes('/register') && (user.companySlug || (user.companyId && user.companyId !== 0))) {
                throw redirect({ to: '/create-company' });
            }

            const { isGlobalPortalHost, resolveSlugFromHost } = await import('@app/schema/utils');
            const { resolvePostAuthRouting, getSafeRedirectPath, executeAuthGuard } = await import('./utils/resolve-routing');

            const isGlobal = isGlobalPortalHost(window.location.hostname);
            const currentSlug = resolveSlugFromHost(window.location.hostname);
            const safeTarget = getSafeRedirectPath(location.search);

            const decision = await resolvePostAuthRouting(user, isGlobal, currentSlug, safeTarget);
            await executeAuthGuard(decision, {
                targetPath: safeTarget,
                currentPathname: location.pathname,
                isAuthPage: true,
                switchOrg: actions.switchOrganization,
            });
        },
        component: AuthLayout,
    });

    const loginRoute = createRoute({
        getParentRoute: () => authRoute,
        path: 'login',
        validateSearch: (search: Record<string, unknown>) => {
            return {
                redirect: (search.redirect as string) || undefined,
                email: (search.email as string) || undefined,
                showSelector: search.showSelector === 'true' || search.showSelector === true || undefined,
            };
        },
        component: Login,
    });

    const registerRoute = createRoute({
        getParentRoute: () => authRoute,
        path: 'register',
        component: lazyRouteComponent(() => import('./pages/Register')),
    });

    const acceptInvitationRoute = createRoute({
        getParentRoute: () => authRoute,
        path: 'accept-invitation',
        validateSearch: (search: Record<string, unknown>) => {
            return {
                token: (search.token as string) || undefined,
                email: (search.email as string) || undefined,
            };
        },
        component: lazyRouteComponent(() => import('./pages/AcceptInvitation')),
    });

    return authRoute.addChildren([loginRoute, registerRoute, acceptInvitationRoute]);
};