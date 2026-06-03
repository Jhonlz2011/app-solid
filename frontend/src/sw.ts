/// <reference lib="webworker" />
import { precacheAndRoute, cleanupOutdatedCaches, createHandlerBoundToURL } from 'workbox-precaching';
import { registerRoute, NavigationRoute } from 'workbox-routing';
import { NetworkFirst, CacheFirst, StaleWhileRevalidate } from 'workbox-strategies';
import { get, set } from 'idb-keyval';

declare const self: ServiceWorkerGlobalScope;

cleanupOutdatedCaches();

// Precachear todos los assets inyectados por Vite en el build
precacheAndRoute(self.__WB_MANIFEST || []);

// Estrategia para navegación global (App Shell) - Servir index.html precacheado
const navigationRoute = new NavigationRoute(createHandlerBoundToURL('index.html'), {
  denylist: [/^\/api/] // Ignorar llamadas al backend
});
registerRoute(navigationRoute);

// Cachear fuentes externas
registerRoute(
  /^https:\/\/fonts\.(?:googleapis|gstatic)\.com\/.*/,
  new CacheFirst({
    cacheName: 'google-fonts',
  })
);

// Escuchar evento de actualización del Service Worker
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// ==========================================
// BACKGROUND SYNC API - BANDEJA DE SALIDA
// ==========================================

self.addEventListener('sync', (event: any) => {
  if (event.tag === 'sync-transactions') {
    event.waitUntil(syncPendingTransactions());
  }
});

async function syncPendingTransactions() {
  console.log('🔄 SW: Iniciando sincronización en segundo plano...');
  const outbox: any[] = (await get('zelys-offline-outbox')) || [];
  if (outbox.length === 0) return;

  const remaining: any[] = [];
  const broadcastChannel = new BroadcastChannel('app_sync');

  for (const item of outbox) {
    try {
      console.log(`📡 SW: Sincronizando transacción: [${item.entity}]`, item.payload);
      
      const response = await fetch(item.url, {
        method: item.method || 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...item.headers,
        },
        body: JSON.stringify(item.payload),
      });

      if (!response.ok) {
        throw new Error(`Error en el servidor con estado: ${response.status}`);
      }

      const result = await response.json();
      console.log(`✅ SW: Sincronización exitosa para: [${item.entity}]`);

      // Notificar a las pestañas activas del ERP que se sincronizó el registro
      broadcastChannel.postMessage({
        type: 'offline:synced',
        entity: item.entity,
        data: result,
      });

    } catch (err) {
      console.error(`❌ SW: Error al sincronizar [${item.entity}]:`, err);
      // Mantener en la cola para reintentar después
      remaining.push(item);
    }
  }

  // Guardar elementos no sincronizados
  await set('zelys-offline-outbox', remaining);
}
