import { createRoute, redirect, lazyRouteComponent } from '@tanstack/solid-router';
import AuthLayout from '@layout/AuthLayout';
import Login from './pages/Login';

export const createAuthRoutes = (rootRoute: any) => {
    const authRoute = createRoute({
        getParentRoute: () => rootRoute,
        id: 'auth-layout',
        beforeLoad: async () => {
            const { actions, useAuth } = await import('./store/auth.store');
            const { authClient } = await import('@shared/lib/auth-client');
            const { isGlobalPortalHost, buildTenantUrl } = await import('@app/schema/utils');
            const auth = useAuth();

            const handleAuthenticatedRouting = async (user: any) => {
                const isGlobal = isGlobalPortalHost(window.location.hostname);

                // Consultar organizaciones reales del usuario desde Better Auth
                let orgs: any[] = [];
                try {
                    const orgRes = await authClient.organization.list();
                    orgs = orgRes?.data || [];
                } catch {}

                // Caso 1: 0 Empresas -> Onboarding obligatorio
                if (orgs.length === 0 && (!user?.companySlug && (!user?.companyId || user.companyId === 0))) {
                    if (typeof window !== 'undefined' && window.location.pathname.includes('/register')) {
                        return;
                    }
                    throw redirect({ to: '/register' });
                }

                // Caso 2: Portal Global (in.zelys.app) con múltiples empresas -> Permitir que Login.tsx muestre el selector
                if (isGlobal && orgs.length > 1) {
                    return;
                }

                // Caso 3: Portal Global con 1 sola empresa -> Fast-Path a su subdominio
                if (isGlobal && orgs.length === 1) {
                    const singleOrg = orgs[0];
                    if (singleOrg.slug) {
                        window.location.href = buildTenantUrl(singleOrg.slug, '/dashboard', { queryParams: { session: 'true' } });
                        return;
                    }
                }

                // Caso 4: Subdominio específico o fallback directo
                if (isGlobal && user?.companySlug) {
                    window.location.href = buildTenantUrl(user.companySlug, '/dashboard', { queryParams: { session: 'true' } });
                    return;
                }

                throw redirect({ to: '/dashboard' });
            };

            // Fast path: already authenticated in memory
            if (auth.isAuthenticated() && auth.user()) {
                await handleAuthenticatedRouting(auth.user());
                return;
            }

            // Si no hay flag de sesión ni parámetro OAuth, no consultar al servidor en páginas de login/register
            const hasSessionFlag = localStorage.getItem('hasSession');
            const hasSessionParam = typeof window !== 'undefined' && window.location.search.includes('session=true');
            if (!hasSessionFlag && !hasSessionParam) {
                return;
            }

            // Validar sesión con el servidor (para soportar retorno de OAuth y cookies entre subdominios)
            const restored = await actions.initSession();
            if (restored && auth.user()) {
                await handleAuthenticatedRouting(auth.user());
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