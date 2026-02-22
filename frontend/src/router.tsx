import { lazy, Component, onMount } from 'solid-js';
import { createRouter, createRootRoute, createRoute, RouterProvider, Outlet, redirect, useParams } from '@tanstack/solid-router';

import MainLayout from './layout/MainLayout';
import { createAuthRoutes } from './modules/auth/auth.routes';

import { connect as connectWs } from './shared/store/ws.store';
import { actions as moduleActions } from './shared/store/modules.store';
import { queryClient } from './shared/lib/queryClient';

const Dashboard = lazy(() => import('./modules/dashboard/views/Dashboard')) as Component;
const UsersRolesPage = lazy(() => import('./modules/users/views/UsersRolesPage')) as Component;
const ProductsPage = lazy(() => import('./modules/products/views/Products')) as Component;
const SuppliersPage = lazy(() => import('./modules/suppliers/views/SuppliersPage')) as Component;

// Suppliers components - Sheet pattern
const SupplierNewSheet = lazy(() => import('./modules/suppliers/components/SupplierNewSheet')) as Component;
const SupplierEditSheet = lazy(() => import('./modules/suppliers/components/SupplierEditSheet')) as Component<{ supplierId: number }>;
const SupplierShowPanel = lazy(() => import('./modules/suppliers/components/SupplierShowPanel')) as Component<{ supplierId: number }>;

const rootRoute = createRootRoute({
  component: () => {
    return <Outlet />;
  },
});

const authRoute = createAuthRoutes(rootRoute);

const ProtectedLayout: Component = () => {
  onMount(() => {
    moduleActions.fetchModules();
    connectWs();
  });

  return (
    <MainLayout>
      <Outlet />
    </MainLayout>
  );
};

const layoutRoute = createRoute({
  getParentRoute: () => rootRoute,
  id: 'layout',
  beforeLoad: async ({ location }) => {
    const { actions, useAuth } = await import('./modules/auth/store/auth.store');
    const auth = useAuth();

    if (auth.isAuthenticated()) {
      return;
    }

    const restored = await actions.initSession();
    if (restored) {
      return;
    }

    throw redirect({
      to: '/login',
      search: {
        redirect: location.href,
      },
    });
  },
  component: ProtectedLayout,
});

const dashboardRoute = createRoute({
  getParentRoute: () => layoutRoute,
  path: 'dashboard',
  component: () => <Dashboard />,
});

const indexRoute = createRoute({
  getParentRoute: () => layoutRoute,
  path: '/',
  component: () => <div />,
  beforeLoad: () => {
    throw redirect({ to: '/dashboard' });
  },
});

const systemUsersRoute = createRoute({
  getParentRoute: () => layoutRoute,
  path: '/system/users',
  beforeLoad: async () => {
    const { useAuth } = await import('./modules/auth/store/auth.store');
    const auth = useAuth();
    if (!auth.canRead('users')) {
      throw redirect({ to: '/dashboard' });
    }
  },
  component: () => <UsersRolesPage />,
});

const ProfilePage = lazy(() => import('./modules/profile/views/ProfilePage')) as Component;

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

const suppliersRoute = createRoute({
  getParentRoute: () => layoutRoute,
  path: 'suppliers',
  beforeLoad: async () => {
    const { useAuth } = await import('./modules/auth/store/auth.store');
    const auth = useAuth();
    if (!auth.canRead('suppliers')) {
      throw redirect({ to: '/dashboard' });
    }
  },
  component: () => <SuppliersPage />,
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

// Edit route with wrapper component
export const supplierEditRoute = createRoute({
  getParentRoute: () => suppliersRoute,
  path: 'edit/$id',
  component: SupplierEditWrapper,
});

// Show route with wrapper component
export const supplierShowRoute = createRoute({
  getParentRoute: () => suppliersRoute,
  path: 'show/$id',
  component: SupplierShowWrapper,
});

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

const router = createRouter({
  routeTree,
  context: {
    queryClient,
  },
  defaultPreload: 'intent',
  defaultPreloadDelay: 100,
});

declare module '@tanstack/solid-router' {
  interface Register {
    router: typeof router;
  }
}

export function RouterApp() {
  return (
    <RouterProvider router={router} />
  );
}

export default router;
