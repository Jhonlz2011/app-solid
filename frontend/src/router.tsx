import { Component, onMount } from 'solid-js';
import { createRouter, createRootRoute, createRoute, RouterProvider, Outlet, redirect, lazyRouteComponent } from '@tanstack/solid-router';

import MainLayout from './layout/MainLayout';
import { createAuthRoutes } from './modules/auth/auth.routes';
import { createSuppliersRoutes } from './modules/suppliers/suppliers.routes';
import { createUsersRoutes } from './modules/users/users.routes';

import { connect as connectWs } from './shared/store/ws.store';
import { queryClient } from './shared/lib/queryClient';

import { LayoutSkeleton } from './layout/MainLayout';
import { ProfilePendingComponent } from './modules/profile/views/ProfilePage';

// --- LAZY COMPONENTS ---
const Dashboard = lazyRouteComponent(() => import('./modules/dashboard/views/Dashboard'));
const NotFound = lazyRouteComponent(() => import('./shared/pages/NotFound'));
const ProfilePage = lazyRouteComponent(() => import('./modules/profile/views/ProfilePage'));

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

// --- HELPER: Permission-guarded module route ---
// const createModuleRoute = (opts: {
//   path: string;
//   permission: string;
//   component: Component;
//   parent?: any;
//   loader?: () => Promise<void> | void;
// }) =>
//   createRoute({
//     getParentRoute: () => opts.parent ?? layoutRoute,
//     path: opts.path,
//     beforeLoad: async () => {
//       const { useAuth } = await import('./modules/auth/store/auth.store');
//       if (!useAuth().canRead(opts.permission)) {
//         throw redirect({ to: '/dashboard' });
//       }
//     },
//     loader: opts.loader,
//     component: () => <opts.component />,
//   });

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

// Users routes are now managed in users.routes.tsx

const settingsGeneralRoute = createRoute({
  getParentRoute: () => layoutRoute,
  path: '/settings/general',
  component: () => <div class="p-6"><h1>Configuración General</h1><p>Próximamente...</p></div>,
});

const profileRoute = createRoute({
  getParentRoute: () => layoutRoute,
  path: '/profile',
  pendingComponent: ProfilePendingComponent,
  component: ProfilePage,
});

// Suppliers routes are now managed in suppliers.routes.tsx

// --- ROUTE TREE ---
const routeTree = rootRoute.addChildren([
  authRoute,
  layoutRoute.addChildren([
    indexRoute,
    dashboardRoute,
    createUsersRoutes(layoutRoute),
    settingsGeneralRoute,
    profileRoute,
    createSuppliersRoutes(layoutRoute),
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
      <div class="p-6 text-center text-danger">
        <h2 class="text-lg font-bold">Algo salió mal</h2>
        <p class="text-sm">Ha ocurrido un error inesperado al cargar la página.</p>
        <button 
          onClick={() => window.location.reload()}
          class="mt-4 px-4 py-2 bg-danger/10 text-danger rounded-lg text-sm"
        >
          Recargar página
        </button>
      </div>
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