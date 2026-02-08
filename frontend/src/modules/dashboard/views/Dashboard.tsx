import { Component, For, Show } from 'solid-js';
import { useQuery } from '@tanstack/solid-query';
import { useAuth } from '@modules/auth/store/auth.store';
// import { productsApi, productKeys } from '@modules/products';

const Dashboard: Component = () => {
  const auth = useAuth();
  const canReadProducts = () => auth.canRead('products');

  // const productsQuery = useQuery(() => ({
  //   queryKey: [...productKeys.lists(), 'dashboard'],
  //   queryFn: async () => productsApi.list({ limit: 5 }),
  //   staleTime: 1000 * 60 * 5, // 5 minutos
  //   enabled: canReadProducts(), // Only fetch if user has permission
  // }));

  const lowStock = () => 0; // TODO: Add lowStock calculation
  // const latestProducts = () => canReadProducts() ? (productsQuery.data?.data ?? []) : [];

  return (
    <div class="p-4 lg:p-6">
      <div class="max-w-7xl mx-auto space-y-6">
        <div class="bg-card border border-border shadow-card-soft rounded-2xl shadow-lg p-6">
          <h1 class="text-3xl font-bold mb-2">Dashboard ERP</h1>
          <p class="text-muted">Vista ejecutiva de órdenes, inventario y logística.</p>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div class="bg-card border border-border shadow-card rounded-3xl p-6">
            <div class="flex items-center justify-between mb-4">
              <h3 class="text-muted text-sm font-medium">Órdenes activas</h3>
              <div class="w-3 h-3 rounded-full" style="background: var(--color-success)" />
            </div>
            <p class=" text-3xl font-bold">{'—'}</p>
            <p class="text-muted text-sm mt-1">
              {0} compromisos esta semana
            </p>
          </div>

          <div class="bg-card border border-border shadow-card rounded-3xl p-6">
            <div class="flex items-center justify-between mb-4">
              <h3 class="text-muted text-sm font-medium">Alertas de inventario</h3>
              <span class="text-muted text-xl">!</span>
            </div>
            <p class=" text-3xl font-bold">{lowStock()}</p>
            <p class="text-muted text-sm mt-1">Productos bajo el mínimo</p>
          </div>

          <div class="bg-card border border-border shadow-card rounded-3xl p-6">
            <div class="flex items-center justify-between mb-4">
              <h3 class="text-muted text-sm font-medium">Guías emitidas</h3>
              <span class="text-muted text-xl">↗</span>
            </div>
            <p class=" text-3xl font-bold">{'—'}</p>
            <p class="text-muted text-sm mt-1">Movimientos logísticos</p>
          </div>
        </div>

        <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div class="bg-card border border-border shadow-card-soft rounded-xl p-6">
            <div class="flex items-center justify-between mb-4">
              <div>
                <h2 class=" text-xl font-semibold">Órdenes recientes</h2>
                <p class="text-muted text-sm">Top 5 últimos registros.</p>
              </div>
            </div>
            <div class="space-y-3">
              {/* <Show
                when={latestProducts().length > 0}
                fallback={<p class="text-muted text-sm">Sin órdenes registradas.</p>}
              >
                <For each={latestProducts()}>
                  {(product) => (
                    <div class="p-3 bg-surface border border-border rounded-lg flex items-center justify-between">
                      <div>
                        <p class=" font-semibold">{product.name}</p>
                        <p class="text-muted text-sm">{product?.brand?.name}</p>
                      </div>
                    </div>
                  )}
                </For>
              </Show> */}
            </div>
          </div>

          <div class="bg-card border border-border shadow-card-soft rounded-xl p-6">
            <h2 class=" text-xl font-semibold mb-4">Sesión y seguridad</h2>
            <div class="space-y-3">
              <div class="flex items-center justify-between p-3 bg-surface border border-border rounded-lg">
                <span class="text-muted">Estado</span>
                <span class="text-green-600 dark:text-green-400 font-semibold">Autenticado</span>
              </div>
              <div class="flex items-center justify-between p-3 bg-surface border border-border rounded-lg">
                <span class="text-muted">Token</span>
                <span class="text-muted text-sm">
                  {auth.isAuthenticated() ? '✓ Activo' : '✗ No disponible'}
                </span>
              </div>
              <div class="flex items-center justify-between p-3 bg-surface border border-border rounded-lg">
                <span class="text-muted">Refresco</span>
                <span class="text-muted text-sm">Automático cada 15 minutos</span>
              </div>
            </div>
          </div>
        </div>

        <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div class="bg-card border border-border shadow-card-soft rounded-xl p-6">
            <h2 class=" text-xl font-semibold mb-4">Guías recientes</h2>
            <div class="space-y-3">

            </div>
          </div>

          <div class="bg-card border border-border shadow-card-soft rounded-xl p-6">
            <h2 class=" text-xl font-semibold mb-4">Inventario crítico</h2>
            <div class="space-y-3">
              {/* <Show
                when={productsQuery.isSuccess && latestProducts().length > 0}
                fallback={<p class="text-muted text-sm">Inventario vacío.</p>}
              >
                <For each={latestProducts()}>
                  {(product) => (
                    <div class="flex items-center justify-between p-3 bg-surface border border-border rounded-lg">
                      <div>
                        <p class=" font-semibold">{product.name}</p>
                        <p class="text-muted text-sm">{product.sku}</p>
                      </div>
                      <div class="text-right">
                        <p class=" text-sm">
                          {product.uom_inventory_code || 'UND'}
                        </p>
                        <p class="text-red-600 dark:text-red-400 text-xs">Min {product.min_stock_alert}</p>
                      </div>
                    </div>
                  )}
                </For>
              </Show> */}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
