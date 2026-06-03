// 1. Añadimos un nombre de caché único y versionado (útil para el futuro cache-busting)
const CACHE = "zelys-cache-v1";

importScripts('https://storage.googleapis.com/workbox-cdn/releases/5.1.2/workbox-sw.js');

// 2. CORREGIDO: Reemplazamos el placeholder por tu archivo real de respaldo
const offlineFallbackPage = "offline.html";

self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

self.addEventListener('install', async (event) => {
  event.waitUntil(
    caches.open(CACHE)
      .then((cache) => cache.add(offlineFallbackPage))
  );
});

if (workbox.navigationPreload.isSupported()) {
  workbox.navigationPreload.enable();
}

/**
 * 3. ¡ALERTA DE ARQUITECTURA PARA TU ERP! 
 * El código original con `new RegExp('/*')` cacheaba ABSOLUTAMENTE TODO, incluyendo las llamadas a tu API.
 * En un sistema de gestión, usar StaleWhileRevalidate en la API provocaría que el usuario vea datos 
 * obsoletos (facturas viejas, stock desactualizado) mientras se busca la versión nueva de fondo.
 * 
 * SOLUCIÓN: Filtramos para que SOLO cachee componentes estáticos (JS, CSS, imágenes) de SolidJS
 * y NUNCA intercepte las rutas que empiecen por '/api' de ElysiaJS.
 */
workbox.routing.registerRoute(
  ({ url }) => !url.pathname.startsWith('/api'), 
  new workbox.strategies.StaleWhileRevalidate({
    cacheName: CACHE
  })
);

// 4. Manejo de navegación global (Mantiene el flujo Network-First para tus páginas)
self.addEventListener('fetch', (event) => {
  if (event.request.mode === 'navigate') {
    event.respondWith((async () => {
      try {
        const preloadResp = await event.preloadResponse;

        if (preloadResp) {
          return preloadResp;
        }

        const networkResp = await fetch(event.request);
        return networkResp;
      } catch (error) {
        // Si falla la red (offline), abrimos la caché y servimos la página de respaldo
        const cache = await caches.open(CACHE);
        const cachedResp = await cache.match(offlineFallbackPage);
        return cachedResp;
      }
    })());
  }
});