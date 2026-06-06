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

// Cachear manifiesto dinámico por tenant
registerRoute(
  ({ url }) => url.pathname.includes('/auth/tenant-manifest'),
  new NetworkFirst({
    cacheName: 'tenant-manifest-cache',
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

const MAX_RETRIES = 3;

async function syncPendingTransactions() {
  console.log('🔄 SW: Iniciando sincronización en segundo plano...');
  const outbox: any[] = (await get('zelys-offline-outbox')) || [];
  if (outbox.length === 0) return;

  const remaining: any[] = [];
  const failed: any[] = [];
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
        credentials: 'include',
        body: JSON.stringify(item.payload),
      });

      if (!response.ok) {
        // 4xx = error del cliente → no reintentar (validación, duplicado, etc.)
        if (response.status >= 400 && response.status < 500) {
          console.warn(`⛔ SW: Error ${response.status} no retentable para [${item.entity}]`);
          failed.push(item);
          continue;
        }
        // 5xx = error del servidor → reintentar
        throw new Error(`Server error: ${response.status}`);
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
      const retryCount = (item.retryCount ?? 0) + 1;
      if (retryCount >= MAX_RETRIES) {
        console.error(`⛔ SW: Máximo de reintentos alcanzado para [${item.entity}]`);
        failed.push(item);
      } else {
        console.warn(`🔁 SW: Reintento ${retryCount}/${MAX_RETRIES} para [${item.entity}]`);
        remaining.push({ ...item, retryCount });
      }
    }
  }

  // Guardar elementos pendientes de reintentar
  await set('zelys-offline-outbox', remaining);

  // Notificar sobre items que fallaron permanentemente
  if (failed.length > 0) {
    broadcastChannel.postMessage({
      type: 'offline:sync-failed',
      count: failed.length,
      items: failed.map((f: any) => ({ entity: f.entity, id: f.id })),
    });
  }
}
