import { Component } from 'solid-js';
import { useAuth } from '@modules/auth/store/auth.store';

const Dashboard: Component = () => {
  const auth = useAuth();

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
            <p class="text-3xl font-bold">{'—'}</p>
            <p class="text-muted text-sm mt-1">Próximamente</p>
          </div>

          <div class="bg-card border border-border shadow-card rounded-3xl p-6">
            <div class="flex items-center justify-between mb-4">
              <h3 class="text-muted text-sm font-medium">Alertas de inventario</h3>
              <span class="text-muted text-xl">!</span>
            </div>
            <p class="text-3xl font-bold">{'—'}</p>
            <p class="text-muted text-sm mt-1">Próximamente</p>
          </div>

          <div class="bg-card border border-border shadow-card rounded-3xl p-6">
            <div class="flex items-center justify-between mb-4">
              <h3 class="text-muted text-sm font-medium">Guías emitidas</h3>
              <span class="text-muted text-xl">↗</span>
            </div>
            <p class="text-3xl font-bold">{'—'}</p>
            <p class="text-muted text-sm mt-1">Próximamente</p>
          </div>
        </div>

        <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div class="bg-card border border-border shadow-card-soft rounded-xl p-6">
            <div class="flex items-center justify-between mb-4">
              <div>
                <h2 class="text-xl font-semibold">Órdenes recientes</h2>
                <p class="text-muted text-sm">Top 5 últimos registros.</p>
              </div>
            </div>
            <div class="space-y-3">
              <p class="text-muted text-sm">Sin órdenes registradas.</p>
            </div>
          </div>

          <div class="bg-card border border-border shadow-card-soft rounded-xl p-6">
            <h2 class="text-xl font-semibold mb-4">Sesión</h2>
            <div class="space-y-3">
              <div class="flex items-center justify-between p-3 bg-surface border border-border rounded-lg">
                <span class="text-muted">Estado</span>
                <span class="text-green-600 dark:text-green-400 font-semibold">
                  {auth.isAuthenticated() ? 'Autenticado' : 'No autenticado'}
                </span>
              </div>
              <div class="flex items-center justify-between p-3 bg-surface border border-border rounded-lg">
                <span class="text-muted">Sesión</span>
                <span class="text-muted text-sm">
                  {auth.isAuthenticated() ? '✓ Cookie httpOnly activa' : '✗ Sin sesión'}
                </span>
              </div>
              <div class="flex items-center justify-between p-3 bg-surface border border-border rounded-lg">
                <span class="text-muted">Usuario</span>
                <span class="text-muted text-sm">{auth.user()?.username || '—'}</span>
              </div>
            </div>
          </div>
        </div>

        <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div class="bg-card border border-border shadow-card-soft rounded-xl p-6">
            <h2 class="text-xl font-semibold mb-4">Guías recientes</h2>
            <div class="space-y-3">
              <p class="text-muted text-sm">Sin guías registradas.</p>
            </div>
          </div>

          <div class="bg-card border border-border shadow-card-soft rounded-xl p-6">
            <h2 class="text-xl font-semibold mb-4">Inventario crítico</h2>
            <div class="space-y-3">
              <p class="text-muted text-sm">Inventario vacío.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
