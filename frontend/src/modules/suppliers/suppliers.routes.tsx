import { Component } from 'solid-js';
import { createRoute, redirect, useParams, lazyRouteComponent } from '@tanstack/solid-router';
import { queryClient } from '@shared/lib/queryClient';
import GlobalPageLoader from '@shared/ui/GlobalPageLoader';

// --- LAZY COMPONENTS ---
const SuppliersPage = lazyRouteComponent(() => import('./views/SuppliersPage'));
const SupplierNewSheet = lazyRouteComponent(() => import('./components/SupplierNewSheet'));
const SupplierEditSheet = lazyRouteComponent(() => import('./components/SupplierEditSheet'));
const SupplierShowPanel = lazyRouteComponent(() => import('./components/SupplierShowPanel'));

// --- WRAPPERS ---
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

export const createSuppliersRoutes = (layoutRoute: any) => {
  const suppliersRoute = createRoute({
    getParentRoute: () => layoutRoute,
    path: 'suppliers',
    beforeLoad: () => {
      import('@modules/auth/store/auth.store').then(({ useAuth }) => {
        if (!useAuth().canRead('suppliers')) {
          throw redirect({ to: '/dashboard' });
        }
      });
    },
    loader: async () => {
      // Parallel Fetching: Block route transition until data is pre-fetched, 
      // explicitly triggering the pendingComponent skeleton.
      const { suppliersApi, supplierKeys } = await import('./data/suppliers.api');
      const defaultFilters = { limit: 10, direction: 'first' as const };
      
      return await queryClient.prefetchQuery({
        queryKey: supplierKeys.list(defaultFilters),
        queryFn: () => suppliersApi.list(defaultFilters),
        staleTime: 60 * 1000,
      });
    },
    pendingComponent: GlobalPageLoader,
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

  const supplierEditRoute = createRoute({
    getParentRoute: () => suppliersRoute,
    path: 'edit/$id',
    component: SupplierEditWrapper,
  });

  const supplierShowRoute = createRoute({
    getParentRoute: () => suppliersRoute,
    path: 'show/$id',
    component: SupplierShowWrapper,
  });

  return suppliersRoute.addChildren([
    suppliersIndexRoute,
    supplierNewRoute,
    supplierEditRoute,
    supplierShowRoute,
  ]);
};
