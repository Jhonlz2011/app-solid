import { lazy, Component } from 'solid-js';
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
  component: () => {
    // Inicializar stores globales
    connectWs();
    authActions.initStore(); // Enable cross-tab session sync
    // Modules se cargan bajo demanda o al autenticar, pero podemos intentar cargar si ya hay sesión
    moduleActions.fetchModules();
    return <Outlet />;
  },
});

// Integrar rutas de autenticación
const authRoute = createAuthRoutes(rootRoute);

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
      // Asegurar que los módulos estén cargados
      moduleActions.fetchModules();
      return;
    }

    // 2. Intentar inicializar sesión (si hay cookie/localStorage)
    const restored = await actions.initSession();
    if (restored) {
      moduleActions.fetchModules();
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
  component: () => (
    <MainLayout>
      <Outlet />
    </MainLayout>
  ),
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
  component: () => <UsersRolesPage />,
});

// Settings routes
const SessionsPage = lazy(() => import('./modules/profile/views/SessionsPage')) as Component;

const settingsSessionsRoute = createRoute({
  getParentRoute: () => layoutRoute,
  path: '/settings/sessions',
  component: () => <SessionsPage />,
});

const settingsGeneralRoute = createRoute({
  getParentRoute: () => layoutRoute,
  path: '/settings/general',
  component: () => <div class="p-6"><h1>Configuración General</h1><p>Próximamente...</p></div>,
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
    settingsSessionsRoute,
    settingsGeneralRoute,
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

