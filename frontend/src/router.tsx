import type { Component } from 'solid-js';
import { 
  createRouter, 
  createRootRoute, 
  createRoute, 
  RouterProvider, 
  Outlet, 
  redirect, 
  lazyRouteComponent,
} from '@tanstack/solid-router';
import { toRealPath, toAliasPath } from './shared/utils/route-alias';

import MainLayout from './layout/MainLayout';
import { createAuthRoutes } from './modules/auth/auth.routes';
import { createSuppliersRoutes } from './modules/suppliers/suppliers.routes';
import { createEmployeesRoutes } from './modules/employees/employees.routes';
import { createClientsRoutes } from './modules/clients/clients.routes';
import { createUsersRoutes } from './modules/rbac/users.routes';
import { createProductsRoutes } from './modules/products/products.routes';
import { createServicesRoutes } from './modules/services/services.routes';
import { createCategoriesRoutes } from './modules/categories/categories.routes';
import { createSettingsRoutes } from './modules/settings/settings.routes';
import { createBrandsRoutes } from './modules/brands/brands.routes';
import { createUomRoutes } from './modules/uom/uom.routes';
import { createAttributesRoutes } from './modules/attributes/attributes.routes';
import { createLocationRoutes } from './modules/locations/locations.routes';
import { createToolsRoutes } from './modules/tools/tools.routes';
import { createCrudLayout } from './shared/routes/crud.layout';

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
const CreateCompany = lazyRouteComponent(() => import('./modules/auth/pages/CreateCompany'));

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
    const { actions } = await import('./modules/auth/store/auth.store');
    const user = await actions.ensureSession();

    const { getSafeRedirectPath, resolvePostAuthRouting, executeAuthGuard } = await import('./modules/auth/utils/resolve-routing');
    const safeTarget = getSafeRedirectPath(location.href);

    if (!user) {
      throw redirect({
        to: '/login',
        search: { redirect: safeTarget !== '/dashboard' ? safeTarget : undefined },
      });
    }

    if (!isEmailVerified(user)) {
      throw redirect({ to: '/verify-email', search: {} });
    }

    const { isGlobalPortalHost, resolveSlugFromHost } = await import('@app/schema/utils');

    const isGlobal = isGlobalPortalHost(window.location.hostname);
    const currentSlug = resolveSlugFromHost(window.location.hostname);
    const decision = await resolvePostAuthRouting(user, isGlobal, currentSlug, safeTarget);

    await executeAuthGuard(decision, {
      targetPath: safeTarget,
      currentPathname: location.pathname,
      isAuthPage: false,
      switchOrg: actions.switchOrganization,
    });
  },
  loader: async () => {
    const { actions } = await import('./shared/store/modules.store');
    return actions.fetchModules();
  },
  pendingComponent: LayoutSkeleton,
  component: ProtectedLayout,
});

// --- ROOT INDEX ROUTE (Despacha la raíz "/" hacia /dashboard de forma protegida) ---
const indexRoute = createRoute({
  getParentRoute: () => layoutRoute,
  path: '/',
  beforeLoad: () => {
    throw redirect({ to: '/dashboard' });
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
  loader: async () => {
    const { profileKeys } = await import('@modules/profile/data/profile.keys');
    const { profileApi } = await import('@modules/profile/data/profile.api');
    const { STALE_TIME } = await import('@shared/constants/cache.constants');
    await Promise.all([
      queryClient.ensureQueryData({
        queryKey: profileKeys.me(),
        queryFn: () => profileApi.getMe(),
        staleTime: STALE_TIME.MEDIUM,
      }),
      queryClient.ensureQueryData({
        queryKey: profileKeys.sessions(),
        queryFn: () => profileApi.getMySessions(),
        staleTime: 60_000,
      }),
    ]);
  },
  component: ProfilePage,
});

const createCompanyRoute = createRoute({
  getParentRoute: () => layoutRoute,
  path: '/create-company',
  component: () => <CreateCompany />,
});

// Suppliers routes are now managed in suppliers.routes.tsx

// --- ROUTE TREE ---
const crudLayout = createCrudLayout(layoutRoute);

const routeTree = rootRoute.addChildren([
  authRoute,
  verifyEmailRoute,
  layoutRoute.addChildren([
    indexRoute,
    dashboardRoute,
    createCompanyRoute,
    createSettingsRoutes(layoutRoute),
    profileRoute,
    createEmployeesRoutes(layoutRoute),
    createProductsRoutes(layoutRoute),
    createServicesRoutes(layoutRoute),
    createCategoriesRoutes(layoutRoute),
    createBrandsRoutes(layoutRoute),
    createUomRoutes(layoutRoute),
    createAttributesRoutes(layoutRoute),
    createLocationRoutes(layoutRoute),
    createToolsRoutes(layoutRoute),
    // Pilot CRUD layout (rutas con navegación instantánea sin bloqueo de layout)
    crudLayout.addChildren([
      createClientsRoutes(crudLayout),
      createSuppliersRoutes(crudLayout),
      createUsersRoutes(crudLayout),
    ]),
  ]),
]);


// --- ROUTER (Native TanStack Router with rewrite subsystem) ---
export const router = createRouter({
  routeTree,
  context: { queryClient },
  rewrite: {
    input: ({ url }) => {
      const real = toRealPath(url.pathname);
      if (real !== url.pathname) {
        url.pathname = real;
        return url;
      }
      return undefined;
    },
    output: ({ url }) => {
      const alias = toAliasPath(url.pathname);
      if (alias !== url.pathname) {
        url.pathname = alias;
        return url;
      }
      return undefined;
    },
  },
  defaultPreload: 'intent',
  defaultPreloadDelay: 100,
  defaultViewTransition: true,
  defaultPendingMs: 200,
  defaultPendingMinMs: 300,
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