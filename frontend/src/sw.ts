/// <reference lib="webworker" />
import { clientsClaim } from 'workbox-core';
import { precacheAndRoute, cleanupOutdatedCaches } from 'workbox-precaching';
import { registerRoute, setCatchHandler } from 'workbox-routing';
import { NetworkFirst, CacheFirst, StaleWhileRevalidate } from 'workbox-strategies';
import { ExpirationPlugin } from 'workbox-expiration';

declare const self: ServiceWorkerGlobalScope;

self.skipWaiting();
clientsClaim();

cleanupOutdatedCaches();

// 1. Precachear los assets del App Shell inyectados por Vite en el build
precacheAndRoute(self.__WB_MANIFEST || []);

// 2. Runtime Caching para Chunks Lazy-Loaded de JavaScript y CSS
// Evita el error bad-precaching-response si un chunk cambió de hash en el nuevo build de AWS/GHCR
registerRoute(
  ({ request, url }) =>
    request.destination === 'script' ||
    request.destination === 'style' ||
    url.pathname.startsWith('/assets/'),
  new StaleWhileRevalidate({
    cacheName: 'app-dynamic-chunks',
    plugins: [
      new ExpirationPlugin({
        maxEntries: 120,
        maxAgeSeconds: 30 * 24 * 60 * 60, // 30 días
      }),
    ],
  })
);

// 3. OPT-05: Use NetworkFirst for navigation routes so the backend can inject
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
  ({ url }) => url.pathname.includes('/tenant-manifest'),
  new NetworkFirst({
    cacheName: 'tenant-manifest-cache',
    networkTimeoutSeconds: 5,
  })
);

// 4. Fallback Offline para Navegación:
// Si el usuario recarga una subruta nunca antes visitada mientras está offline,
// se devuelve la última página/shell disponible en branded-navigation
setCatchHandler(async ({ request }) => {
  if (request.mode === 'navigate') {
    const cache = await caches.open('branded-navigation');
    const keys = await cache.keys();
    if (keys.length > 0) {
      const match = await cache.match(keys[0]);
      if (match) return match;
    }
  }
  return Response.error();
});

// Escuchar evento de actualización del Service Worker
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
