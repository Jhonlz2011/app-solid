import { defineConfig } from 'vite';
import solidPlugin from 'vite-plugin-solid';
import tailwindcss from '@tailwindcss/vite';
import devtools from 'solid-devtools/vite';
import tsconfigPaths from 'vite-tsconfig-paths';
import compression from 'vite-plugin-compression';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    devtools(),
    tailwindcss(), // TailwindCSS debe ir antes de solidPlugin
    solidPlugin(),
    tsconfigPaths(),
    compression({ algorithm: 'brotliCompress', ext: '.br' }), // Alta compresión Brotli
    compression({ algorithm: 'gzip', ext: '.gz' }), // Fallback Gzip
    VitePWA({
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.ts',
      registerType: 'prompt',
      injectRegister: 'auto',
      includeAssets: ['favicon.ico', 'icons/*.png'],
      manifest: {
        name: 'Zelys',
        short_name: 'Zelys',
        id: '/?source=pwa',
        description: 'Plataforma ERP de alto rendimiento con facturación electrónica integrada, gestión de inventarios y experiencia de usuario optimizada de cero latencia',
        start_url: '/?source=pwa',
        scope: '/',
        display: 'standalone',
        theme_color: '#0e1629',
        background_color: '#000000',
        categories: ['business', 'finance', 'productivity'],
        icons: [
          {
            src: 'icons/logo-blank-192x192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any'
          },
          {
            src: 'icons/logo-blank-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any'
          },
          {
            src: 'icons/launchericon-192x192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'maskable'
          },
          {
            src: 'icons/launchericon-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable'
          }
        ],
        shortcuts: [
          {
            name: 'Nuevo Documento Electrónico',
            url: '/documents/new',
            description: 'Acceso directo para emitir nuevos comprobantes electrónicos'
          },
          {
            name: 'Ver Inventario',
            url: '/inventory',
            description: 'Acceso directo al control de stock'
          }
        ]
      }
    }),
  ],
  server: {
    port: 5173,
    host: true,
  },
  build: {
    target: 'esnext',
    // Optimización de cachés: Separar dependencias pesadas que no cambian en chunks dedicados
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-solid': ['solid-js', 'solid-js/web', 'solid-js/store'],
          'vendor-tanstack': ['@tanstack/solid-query', '@tanstack/solid-router', '@tanstack/solid-form', '@tanstack/solid-table'],
          'vendor-kobalte': ['@kobalte/core'],
        },
      },
    },
  },
});
