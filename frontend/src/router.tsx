import { Component } from 'solid-js';
import { createRouter, createRootRoute, createRoute, RouterProvider, Outlet, redirect, lazyRouteComponent } from '@tanstack/solid-router';

import MainLayout from './layout/MainLayout';
import { createAuthRoutes } from './modules/auth/auth.routes';
import { createSuppliersRoutes } from './modules/suppliers/suppliers.routes';
import { createEmployeesRoutes } from './modules/employees/employees.routes';
import { createClientsRoutes } from './modules/clients/clients.routes';
import { createUsersRoutes } from './modules/users/users.routes';
import { createProductsRoutes } from './modules/products/products.routes';
import { createServicesRoutes } from './modules/services/services.routes';
import { createCategoriesRoutes } from './modules/categories/categories.routes';
import { createSettingsRoutes } from './modules/settings/settings.routes';
import { createBrandsRoutes } from './modules/brands/brands.routes';
import { createUomRoutes } from './modules/uom/uom.routes';
import { createAttributesRoutes } from './modules/attributes/attributes.routes';
import { createLocationRoutes } from './modules/locations/locations.routes';

// P1-5: Removed connectSSE import — SSE connection is managed solely by MainLayout.createEffect(isOnline())
import { queryClient } from './shared/lib/queryClient';
import ErrorState from './shared/ui/display/ErrorState';

import { LayoutSkeleton } from './layout/MainLayout';
import { ProfilePendingComponent } from './modules/profile/views/ProfilePage';

// --- LAZY COMPONENTS ---
const Dashboard = lazyRouteComponent(() => import('./modules/dashboard/views/Dashboard'));
const NotFound = lazyRouteComponent(() => import('./shared/pages/NotFound'));
const ProfilePage = lazyRouteComponent(() => import('./modules/profile/views/ProfilePage'));
const VerifyEmailPage = lazyRouteComponent(() => import('./modules/auth/pages/VerifyEmail'));

// --- ROOT ---
const rootRoute = createRootRoute({
  component: () => <Outlet />,
  notFoundComponent: () => <NotFound />,
});

// --- AUTH ROUTES (login) ---
const authRoute = createAuthRoutes(rootRoute);

const isEmailVerified = (user: any): boolean => {
  if (!user) return false;
  // emailVerified (boolean) es la fuente de verdad del backend.
  // Solo bloqueamos si es EXPLÍCITAMENTE false.
  // Si es undefined (campo no presente), asumimos verificado para no bloquear usuarios legítimos.
  if (user.emailVerified === false) return false;
  if (user.emailVerified === true) return true;
  // Si el campo no existe, asumir verificado (defensivo)
  return true;
};

const verifyEmailRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: 'verify-email',
  validateSearch: (search: Record<string, unknown>) => ({
    token: (search.token as string) || undefined,
  }),
  beforeLoad: async ({ search }) => {
    // Si viene un token en los parámetros de búsqueda, permitir cargar para verificarlo
    if (search?.token) return;

    const { useAuth } = await import('./modules/auth/store/auth.store');
    const auth = useAuth();
    if (auth.isAuthenticated() && isEmailVerified(auth.user())) {
      throw redirect({ to: '/dashboard' });
    }
  },
  component: VerifyEmailPage,
});

// --- PROTECTED LAYOUT ---
// P1-5: Removed redundant connectSSE() from onMount — MainLayout.createEffect(isOnline()) is the
// single source of truth for SSE connection. auth.store also connects on login/initSession.
const ProtectedLayout: Component = () => {
  return <MainLayout />;
};

const layoutRoute = createRoute({
  getParentRoute: () => rootRoute,
  id: 'layout',
  beforeLoad: async ({ location }) => {
    const { actions, useAuth } = await import('./modules/auth/store/auth.store');
    const { isGlobalPortalHost, buildTenantUrl, resolveSlugFromHost } = await import('@app/schema/utils');
    const { resolvePostAuthRouting } = await import('./modules/auth/utils/resolve-routing');
    const auth = useAuth();

    const isGlobal = isGlobalPortalHost(window.location.hostname);
    const currentSlug = resolveSlugFromHost(window.location.hostname);

    const getSafeRedirect = () => {
      const p = location.pathname;
      if (!p || p === '/' || p === '/dashboard' || p.startsWith('/login') || p.startsWith('/register') || p === '/verify-email') {
        return undefined;
      }
      return p;
    };

    const handleProtectedRouting = async (u: any) => {
      if (u && !isEmailVerified(u)) {
        throw redirect({ to: '/verify-email', search: {} });
      }

      const decision = await resolvePostAuthRouting(u, isGlobal, currentSlug, location.pathname);

      switch (decision.action) {
        case 'onboard':
          throw redirect({ to: '/register' });
        case 'show-selector':
        case 'no-access':
          throw redirect({ to: '/login' });
        case 'redirect-tenant':
          window.location.href = buildTenantUrl(decision.slug, decision.path, {
            queryParams: { session: 'true' },
          });
          return;
        case 'stay':
          if (decision.organizationId) {
            await actions.switchOrganization(decision.organizationId);
          }
          return;
      }
    };

    // FAST PATH: Already authenticated in memory
    if (auth.isAuthenticated() && auth.user()) {
      await handleProtectedRouting(auth.user());
      return;
    }

    // COLD PATH: Check session flag before hitting server
    const hasSessionFlag = localStorage.getItem('hasSession');
    const hasSessionParam = typeof window !== 'undefined' && window.location.search.includes('session=true');
    if (!hasSessionFlag && !hasSessionParam) {
      throw redirect({ to: '/login', search: { redirect: getSafeRedirect() } });
    }

    // Restore session from server (cookie-based)
    const restored = await actions.initSession();
    if (restored && auth.user()) {
      await handleProtectedRouting(auth.user());
      return;
    }

    throw redirect({ to: '/login', search: { redirect: getSafeRedirect() } });
  },
  loader: async () => {
    const { actions } = await import('./shared/store/modules.store');
    return actions.fetchModules();
  },
  pendingComponent: LayoutSkeleton,
  component: ProtectedLayout,
});

// --- ROOT INDEX ROUTE (Despacho limpio de la raíz "/" sin montar layout protegido) ---
const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  beforeLoad: async () => {
    const { actions, useAuth } = await import('./modules/auth/store/auth.store');
    const { isGlobalPortalHost, buildTenantUrl, resolveSlugFromHost } = await import('@app/schema/utils');
    const { resolvePostAuthRouting } = await import('./modules/auth/utils/resolve-routing');
    const auth = useAuth();

    const isGlobal = isGlobalPortalHost(window.location.hostname);
    const currentSlug = resolveSlugFromHost(window.location.hostname);

    const handleRouting = async (user: any) => {
      const decision = await resolvePostAuthRouting(user, isGlobal, currentSlug);

      switch (decision.action) {
        case 'onboard':
          throw redirect({ to: '/register' });
        case 'show-selector':
          throw redirect({ to: '/login' });
        case 'no-access':
          throw redirect({ to: '/login' });
        case 'redirect-tenant':
          window.location.href = buildTenantUrl(decision.slug, '/dashboard', {
            queryParams: { session: 'true' },
          });
          return;
        case 'stay':
          if (decision.organizationId) {
            await actions.switchOrganization(decision.organizationId);
          }
          throw redirect({ to: '/dashboard' });
      }
    };

    // Fast path: usuario ya autenticado en memoria
    if (auth.isAuthenticated() && auth.user()) {
      await handleRouting(auth.user());
      return;
    }

    // Comprobar si hay sesión activa antes de consultar al backend
    const hasSessionFlag = localStorage.getItem('hasSession');
    const hasSessionParam = typeof window !== 'undefined' && window.location.search.includes('session=true');
    if (hasSessionFlag || hasSessionParam) {
      const restored = await actions.initSession();
      if (restored && auth.user()) {
        await handleRouting(auth.user());
      }
    }

    // Usuario no autenticado → ir a /login
    throw redirect({ to: '/login' });
  },
});

const dashboardRoute = createRoute({
  getParentRoute: () => layoutRoute,
  path: 'dashboard',
  component: () => <Dashboard />,
});

// Users routes are now managed in users.routes.tsx



const profileRoute = createRoute({
  getParentRoute: () => layoutRoute,
  path: '/profile',
  pendingComponent: ProfilePendingComponent,
  component: ProfilePage,
});

// Suppliers routes are now managed in suppliers.routes.tsx

// --- ROUTE TREE ---
const routeTree = rootRoute.addChildren([
  indexRoute,
  authRoute,
  verifyEmailRoute,
  layoutRoute.addChildren([
    dashboardRoute,
    createUsersRoutes(layoutRoute),
    createSettingsRoutes(layoutRoute),
    profileRoute,
    createSuppliersRoutes(layoutRoute),
    createEmployeesRoutes(layoutRoute),
    createClientsRoutes(layoutRoute),
    createProductsRoutes(layoutRoute),
    createServicesRoutes(layoutRoute),
    createCategoriesRoutes(layoutRoute),
    createBrandsRoutes(layoutRoute),
    createUomRoutes(layoutRoute),
    createAttributesRoutes(layoutRoute),
    createLocationRoutes(layoutRoute),
  ]),
]);


// --- ROUTER ---
export const router = createRouter({
  routeTree,
  context: { queryClient },
  defaultPreload: 'intent',
  defaultPreloadDelay: 100,
  defaultViewTransition: true,
  defaultErrorComponent: ({ error }) => {
    console.error(error);
    return (
      <ErrorState 
        title="Algo salió mal"
        description="Ha ocurrido un error inesperado al cargar la página."
        onRetry={() => window.location.reload()}
        retryLabel="Recargar página"
        class="p-6"
      />
    );
  }
});

declare module '@tanstack/solid-router' {
  interface Register {
    router: typeof router;
  }
}

export function RouterApp() {
  return <RouterProvider router={router} />;
}