import { defineConfig } from 'vite';
import solidPlugin from 'vite-plugin-solid';
import tailwindcss from '@tailwindcss/vite';
import devtools from 'solid-devtools/vite';
import tsconfigPaths from 'vite-tsconfig-paths';
import compression from 'vite-plugin-compression';

export default defineConfig({
  plugins: [
    devtools(),
    tailwindcss(), // TailwindCSS debe ir antes de solidPlugin
    solidPlugin(),
    tsconfigPaths(),
    compression({ algorithm: 'brotliCompress', ext: '.br' }), // Alta compresión Brotli
    compression({ algorithm: 'gzip', ext: '.gz' }), // Fallback Gzip
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
