import { defineConfig } from 'vite';
import solidPlugin from 'vite-plugin-solid';
import tailwindcss from '@tailwindcss/vite';
import devtools from 'solid-devtools/vite';
import tsconfigPaths from 'vite-tsconfig-paths';
import viteCompression from 'vite-plugin-compression';

export default defineConfig({
  plugins: [
    devtools(),
    tailwindcss(), // TailwindCSS debe ir antes de solidPlugin
    solidPlugin(),
    tsconfigPaths(),
    viteCompression({ algorithm: 'brotliCompress', ext: '.br', threshold: 1024 })
  ],
  server: {
    port: 5173,
    host: true,
  },
  build: {
    target: 'esnext',
  },
});
