import { createRoute, redirect, lazyRouteComponent } from '@tanstack/solid-router';
import AuthLayout from '@layout/AuthLayout';
import Login from './pages/Login';

export const createAuthRoutes = (rootRoute: any) => {
    const authRoute = createRoute({
        getParentRoute: () => rootRoute,
        id: 'auth-layout',
        beforeLoad: async () => {
            const { actions, useAuth } = await import('./store/auth.store');
            const { isGlobalPortalHost, buildTenantUrl, resolveSlugFromHost } = await import('@app/schema/utils');
            const { resolvePostAuthRouting } = await import('./utils/resolve-routing');
            const auth = useAuth();

            const isGlobal = isGlobalPortalHost(window.location.hostname);
            const currentSlug = resolveSlugFromHost(window.location.hostname);

            const handleRouting = async (user: any) => {
                const decision = await resolvePostAuthRouting(user, isGlobal, currentSlug);

                switch (decision.action) {
                    case 'onboard':
                        if (window.location.pathname.includes('/register')) return;
                        throw redirect({ to: '/register' });

                    case 'show-selector':
                        // Let Login.tsx render and show the tenant selector (global portal only)
                        return;

                    case 'no-access':
                        // User doesn't belong to this tenant subdomain — let Login.tsx show denial UI
                        return;

                    case 'redirect-tenant':
                        window.location.href = buildTenantUrl(decision.slug, decision.path, {
                            queryParams: { session: 'true' },
                        });
                        return;

                    case 'stay':
                        // Auto-switch to the matching org if provided (subdomain match)
                        if (decision.organizationId) {
                            await actions.switchOrganization(decision.organizationId);
                        }
                        throw redirect({ to: '/dashboard' });
                }
            };

            // Fast path: already authenticated in memory
            if (auth.isAuthenticated() && auth.user()) {
                await handleRouting(auth.user());
                return;
            }

            // Si no hay flag de sesión ni parámetro OAuth, no consultar al servidor
            const hasSessionFlag = localStorage.getItem('hasSession');
            const hasSessionParam = typeof window !== 'undefined' && window.location.search.includes('session=true');
            if (!hasSessionFlag && !hasSessionParam) {
                return;
            }

            // Validar sesión con el servidor (para soportar retorno de OAuth y cookies entre subdominios)
            const restored = await actions.initSession();
            if (restored && auth.user()) {
                await handleRouting(auth.user());
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

    return authRoute.addChildren([loginRoute, registerRoute]);
};