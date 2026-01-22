import { lazy, Component, onMount } from 'solid-js';
import { createRouter, createRootRoute, createRoute, RouterProvider, Outlet, redirect } from '@tanstack/solid-router';

import MainLayout from './layout/MainLayout';
import { createAuthRoutes } from './modules/auth';

import { connect as connectWs } from './shared/store/ws.store';
import { actions as moduleActions } from './shared/store/modules.store';
import { actions as authActions } from './modules/auth/auth.store';
import { queryClient } from './shared/lib/queryClient';

const Dashboard = lazy(() => import('./modules/dashboard/views/Dashboard')) as Component;
const UsersRolesPage = lazy(() => import('./modules/users/views/UsersRolesPage')) as Component;

// Lazy load Products module - reduces initial bundle by ~50-70 KiB
const ProductsPage = lazy(() => import('./modules/products/views/Products')) as Component;
const ProductShowPanel = lazy(() => import('./modules/products/components/ProductShowPanel')) as Component;
const ProductEditPanel = lazy(() => import('./modules/products/components/ProductEditPanel')) as Component;
const ProductNewPanel = lazy(() => import('./modules/products/components/ProductNewPanel')) as Component;

// Crear la ruta raíz simple - TanStack Router maneja Suspense internamente
const rootRoute = createRootRoute({
  beforeLoad: () => {
    // Initialize auth store listeners FIRST (before any auth checks)
    // This ensures BroadcastChannel is ready to receive/respond to token requests
    authActions.initStore();
  },
  component: () => {
    // Root just renders children - WebSocket and modules are initialized in layoutRoute (protected)
    return <Outlet />;
  },
});

// Integrar rutas de autenticación
const authRoute = createAuthRoutes(rootRoute);

// Layout wrapper component that initializes modules and WebSocket
const ProtectedLayout: Component = () => {
  onMount(() => {
    // Load modules only once when layout mounts
    moduleActions.fetchModules();
  });

  // Initialize WebSocket only for authenticated users
  connectWs();

  return (
    <MainLayout>
      <Outlet />
    </MainLayout>
  );
};

// Ruta para páginas con Layout (protegidas)
const layoutRoute = createRoute({
  getParentRoute: () => rootRoute,
  id: 'layout',
  beforeLoad: async ({ location }) => {
    // Importamos dinámicamente para evitar ciclos
    const { actions, useAuth } = await import('./modules/auth/auth.store');
    const auth = useAuth();

    // 1. Si ya estamos autenticados, todo bien
    if (auth.isAuthenticated()) {
      return;
    }

    // 2. Intentar inicializar sesión (si hay cookie/localStorage)
    const restored = await actions.initSession();
    if (restored) {
      return;
    }

    // 3. Si falla, redirigir a login
    throw redirect({
      to: '/login',
      search: {
        redirect: location.href,
      },
    });
  },
  component: ProtectedLayout,
});

// Crear las rutas hijas del layout - solo el contenido
const dashboardRoute = createRoute({
  getParentRoute: () => layoutRoute,
  path: 'dashboard',
  component: () => <Dashboard />,
});

const indexRoute = createRoute({
  getParentRoute: () => layoutRoute,
  path: '/',
  component: () => <div />, // Placeholder, will redirect
  beforeLoad: () => {
    throw redirect({ to: '/dashboard' });
  },
});

// Parent route - renders ProductsPage which stays mounted
// ProductsPage contains an Outlet where child routes render
const productsRoute = createRoute({
  getParentRoute: () => layoutRoute,
  path: 'products',
  beforeLoad: async () => {
    // Permission guard for products module
    const { useAuth } = await import('./modules/auth/auth.store');
    const auth = useAuth();
    if (!auth.canRead('products')) {
      throw redirect({ to: '/dashboard' });
    }
  },
  component: ProductsPage,
});

// Child routes for products - these render inside ProductsPage's Outlet
const productsIndexRoute = createRoute({
  getParentRoute: () => productsRoute,
  path: '/',
  component: () => null, // Index route renders nothing in the Outlet
});

const productShowRoute = createRoute({
  getParentRoute: () => productsRoute,
  path: '/show/$id',
  component: ProductShowPanel,
});

const productEditRoute = createRoute({
  getParentRoute: () => productsRoute,
  path: '/edit/$id',
  component: ProductEditPanel,
});

const productNewRoute = createRoute({
  getParentRoute: () => productsRoute,
  path: '/new',
  component: ProductNewPanel,
});

// System routes
const systemUsersRoute = createRoute({
  getParentRoute: () => layoutRoute,
  path: '/system/users',
  beforeLoad: async () => {
    // Permission guard for users module
    const { useAuth } = await import('./modules/auth/auth.store');
    const auth = useAuth();
    if (!auth.canRead('users')) {
      throw redirect({ to: '/dashboard' });
    }
  },
  component: () => <UsersRolesPage />,
});

// Profile route
const ProfilePage = lazy(() => import('./modules/profile/views/ProfilePage')) as Component;

const settingsGeneralRoute = createRoute({
  getParentRoute: () => layoutRoute,
  path: '/settings/general',
  component: () => <div class="p-6"><h1>Configuración General</h1><p>Próximamente...</p></div>,
});

// Profile route
const profileRoute = createRoute({
  getParentRoute: () => layoutRoute,
  path: '/profile',
  component: () => <ProfilePage />,
});

// Construir el árbol de rutas
const routeTree = rootRoute.addChildren([
  authRoute,
  layoutRoute.addChildren([
    indexRoute,
    dashboardRoute,
    productsRoute.addChildren([
      productsIndexRoute,
      productShowRoute,
      productEditRoute,
      productNewRoute,
    ]),
    systemUsersRoute,
    settingsGeneralRoute,
    profileRoute,
  ]),
]);

// Crear el router con opciones de precarga
const router = createRouter({
  routeTree,
  context: {
    queryClient,
  },
  defaultPreload: 'intent', // Precargar al hover
  defaultPreloadDelay: 100,
});

// Declarar el tipo del router para TypeScript
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

