/// <reference lib="webworker" />
import { precacheAndRoute, cleanupOutdatedCaches } from 'workbox-precaching';
import { registerRoute } from 'workbox-routing';
import { NetworkFirst, CacheFirst } from 'workbox-strategies';
import { get, set } from 'idb-keyval';

declare const self: ServiceWorkerGlobalScope;

cleanupOutdatedCaches();

// Precachear todos los assets inyectados por Vite en el build
precacheAndRoute(self.__WB_MANIFEST || []);

// OPT-05: Use NetworkFirst for navigation routes so the backend can inject
// dynamic tenant branding into index.html. Falls back to cache when offline.
registerRoute(
  ({ request }) => request.mode === 'navigate' && !new URL(request.url).pathname.startsWith('/api'),
  new NetworkFirst({
    cacheName: 'branded-navigation',
    networkTimeoutSeconds: 3,
  })
);

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
    networkTimeoutSeconds: 5,
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
  // P0-3: Create channel once, close at end to prevent resource leak
  let broadcastChannel: BroadcastChannel | null = null;
  broadcastChannel = new BroadcastChannel('app_sync');

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
      broadcastChannel!.postMessage({
        type: 'offline:synced',
        data: { entity: item.entity, result },
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
    broadcastChannel!.postMessage({
      type: 'offline:sync-failed',
      data: {
        count: failed.length,
        items: failed.map((f: any) => ({ entity: f.entity, id: f.id })),
      },
    });
  }

  // P0-3: Close the BroadcastChannel to prevent resource leaks in long-lived SW
  broadcastChannel?.close();
}
