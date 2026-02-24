import { lazy, Component, onMount } from 'solid-js';
import { createRouter, createRootRoute, createRoute, RouterProvider, Outlet, redirect, useParams } from '@tanstack/solid-router';

import MainLayout from './layout/MainLayout';
import { createAuthRoutes } from './modules/auth/auth.routes';

import { connect as connectWs } from './shared/store/ws.store';
import { actions as moduleActions } from './shared/store/modules.store';
import { queryClient } from './shared/lib/queryClient';

// --- LAZY COMPONENTS ---
const Dashboard = lazy(() => import('./modules/dashboard/views/Dashboard')) as Component;
const UsersRolesPage = lazy(() => import('./modules/users/views/UsersRolesPage')) as Component;
const ProductsPage = lazy(() => import('./modules/products/views/Products')) as Component;
const SuppliersPage = lazy(() => import('./modules/suppliers/views/SuppliersPage')) as Component;
const ProfilePage = lazy(() => import('./modules/profile/views/ProfilePage')) as Component;
const NotFound = lazy(() => import('./shared/pages/NotFound')) as Component;

// Suppliers components - Sheet pattern
const SupplierNewSheet = lazy(() => import('./modules/suppliers/components/SupplierNewSheet')) as Component;
const SupplierEditSheet = lazy(() => import('./modules/suppliers/components/SupplierEditSheet')) as Component<{ supplierId: number }>;
const SupplierShowPanel = lazy(() => import('./modules/suppliers/components/SupplierShowPanel')) as Component<{ supplierId: number }>;

// --- ROOT ---
const rootRoute = createRootRoute({
  component: () => <Outlet />,
  notFoundComponent: () => <NotFound />,
});

// --- AUTH ROUTES (login) ---
const authRoute = createAuthRoutes(rootRoute);

// --- PROTECTED LAYOUT ---
const ProtectedLayout: Component = () => {
  onMount(() => {
    moduleActions.fetchModules();
    connectWs();
  });

  return <MainLayout />;
};

const layoutRoute = createRoute({
  getParentRoute: () => rootRoute,
  id: 'layout',
  beforeLoad: async ({ location }) => {
    const { actions, useAuth } = await import('./modules/auth/store/auth.store');
    const auth = useAuth();

    // Fast path: already authenticated in memory
    if (auth.isAuthenticated()) return;

    // Fast path: no session flag → redirect to login instantly (zero API calls)
    if (!localStorage.getItem('hasSession')) {
      throw redirect({ to: '/login', search: { redirect: location.href } });
    }

    // Session flag exists but state not initialized → validate with server
    const restored = await actions.initSession();
    if (restored) return;

    throw redirect({ to: '/login', search: { redirect: location.href } });
  },
  component: ProtectedLayout,
});

// --- HELPER: Permission-guarded module route ---
const createModuleRoute = (opts: {
  path: string;
  permission: string;
  component: Component;
  parent?: any;
}) =>
  createRoute({
    getParentRoute: () => opts.parent ?? layoutRoute,
    path: opts.path,
    beforeLoad: async () => {
      const { useAuth } = await import('./modules/auth/store/auth.store');
      if (!useAuth().canRead(opts.permission)) {
        throw redirect({ to: '/dashboard' });
      }
    },
    component: () => <opts.component />,
  });

// --- ROUTES ---
const indexRoute = createRoute({
  getParentRoute: () => layoutRoute,
  path: '/',
  beforeLoad: () => { throw redirect({ to: '/dashboard' }); },
});

const dashboardRoute = createRoute({
  getParentRoute: () => layoutRoute,
  path: 'dashboard',
  component: () => <Dashboard />,
});

const systemUsersRoute = createModuleRoute({
  path: '/system/users',
  permission: 'users',
  component: UsersRolesPage,
});

const settingsGeneralRoute = createRoute({
  getParentRoute: () => layoutRoute,
  path: '/settings/general',
  component: () => <div class="p-6"><h1>Configuración General</h1><p>Próximamente...</p></div>,
});

const profileRoute = createRoute({
  getParentRoute: () => layoutRoute,
  path: '/profile',
  component: () => <ProfilePage />,
});

const suppliersRoute = createModuleRoute({
  path: 'suppliers',
  permission: 'suppliers',
  component: SuppliersPage,
});

const suppliersIndexRoute = createRoute({
  getParentRoute: () => suppliersRoute,
  path: '/',
  component: () => null,
});

const supplierNewRoute = createRoute({
  getParentRoute: () => suppliersRoute,
  path: 'new',
  component: () => <SupplierNewSheet />,
});

const SupplierEditWrapper = () => {
  const params = useParams({ strict: false });
  const supplierId = Number(params()?.id) || 0;
  return <SupplierEditSheet supplierId={supplierId} />;
};

const SupplierShowWrapper = () => {
  const params = useParams({ strict: false });
  const supplierId = Number(params()?.id) || 0;
  return <SupplierShowPanel supplierId={supplierId} />;
};

export const supplierEditRoute = createRoute({
  getParentRoute: () => suppliersRoute,
  path: 'edit/$id',
  component: SupplierEditWrapper,
});

export const supplierShowRoute = createRoute({
  getParentRoute: () => suppliersRoute,
  path: 'show/$id',
  component: SupplierShowWrapper,
});

// --- ROUTE TREE ---
const routeTree = rootRoute.addChildren([
  authRoute,
  layoutRoute.addChildren([
    indexRoute,
    dashboardRoute,
    systemUsersRoute,
    settingsGeneralRoute,
    profileRoute,
    suppliersRoute.addChildren([
      suppliersIndexRoute,
      supplierNewRoute,
      supplierEditRoute,
      supplierShowRoute,
    ]),
  ]),
]);

// --- ROUTER ---
const router = createRouter({
  routeTree,
  context: { queryClient },
  defaultPreload: 'intent',
  defaultPreloadDelay: 100,
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
