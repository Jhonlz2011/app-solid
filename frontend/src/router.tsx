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
    const { isGlobalPortalHost, buildTenantUrl } = await import('@app/schema/utils');
    const auth = useAuth();

    const enforceTenantHost = (user: any): boolean => {
      if (typeof window === 'undefined') return false;
      // Si el usuario está autenticado pero aún no tiene empresa configurada -> redirigir a /register
      if (!user?.companySlug && (!user?.companyId || user.companyId === 0)) {
        throw redirect({ to: '/register' });
      }
      const isGlobal = isGlobalPortalHost(window.location.hostname);
      if (isGlobal && user?.companySlug) {
        window.location.href = buildTenantUrl(user.companySlug, location.pathname, { queryParams: { session: 'true' } });
        return true;
      }
      return false;
    };

    // Fast path: already authenticated in memory
    if (auth.isAuthenticated()) {
      const u = auth.user();
      if (u && !isEmailVerified(u)) {
        throw redirect({ to: '/verify-email', search: {} });
      }
      if (enforceTenantHost(u)) return;
      return;
    }

    const getSafeRedirect = () => {
      const p = location.pathname;
      if (!p || p === '/' || p === '/dashboard' || p.startsWith('/login') || p.startsWith('/register') || p === '/verify-email') {
        return undefined;
      }
      return p;
    };

    // Validar sesión con el servidor (vía cookie HttpOnly better-auth.session_token)
    const restored = await actions.initSession();
    if (restored) {
      const u = auth.user();
      if (u && !isEmailVerified(u)) {
        throw redirect({ to: '/verify-email', search: {} });
      }
      if (enforceTenantHost(u)) return;
      return;
    }

    throw redirect({ to: '/login', search: { redirect: getSafeRedirect() } });
  },
  loader: async () => {
    // Parallel Fetching: the Sidebar items will be downloaded IN PARALLEL 
    // with any child route (like /profile or /suppliers).
    // This entirely prevents layout shifting after the page mounts.
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
    const { isGlobalPortalHost, buildTenantUrl } = await import('@app/schema/utils');
    const auth = useAuth();

    const handleAuthenticatedRedirect = (user: any) => {
      if (!user?.companySlug && (!user?.companyId || user.companyId === 0)) {
        throw redirect({ to: '/register' });
      }
      const isGlobal = isGlobalPortalHost(window.location.hostname);
      if (isGlobal && user?.companySlug) {
        window.location.href = buildTenantUrl(user.companySlug, '/dashboard', { queryParams: { session: 'true' } });
        return;
      }
      throw redirect({ to: '/dashboard' });
    };

    // Fast path: usuario ya autenticado en memoria
    if (auth.isAuthenticated() && auth.user()) {
      handleAuthenticatedRedirect(auth.user());
    }

    // Comprobar si hay sesión activa antes de consultar al backend
    const hasSessionFlag = localStorage.getItem('hasSession');
    const hasSessionParam = typeof window !== 'undefined' && window.location.search.includes('session=true');
    if (hasSessionFlag || hasSessionParam) {
      const restored = await actions.initSession();
      if (restored && auth.user()) {
        handleAuthenticatedRedirect(auth.user());
      }
    }

    // Usuario no autenticado que ingresa a "/" -> ir directo a /login de forma limpia (sin parámetros de búsqueda)
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
const router = createRouter({
  routeTree,
  context: { queryClient },
  defaultPreload: 'intent',
  defaultPreloadDelay: 100,
  defaultViewTransition: false,
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

export default router;