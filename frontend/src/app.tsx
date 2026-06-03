
/* @refresh reload */
import { render } from 'solid-js/web';
import { onMount } from 'solid-js';
import 'solid-devtools';
import './index.css';

import { RouterApp } from './router';
import { QueryClientProvider } from '@tanstack/solid-query';
import { queryClient } from './shared/lib/queryClient';
import { ThemeProvider } from './contexts/ThemeContext';
import { Toaster } from 'solid-sonner';

import { actions as authActions } from './modules/auth/store/auth.store';

const root = document.getElementById('root');

if (import.meta.env.DEV && !(root instanceof HTMLElement)) {
    throw new Error(
        'Root element not found. Did you forget to add it to your index.html? Or maybe the id attribute got misspelled?',
    );
}

// Initialize auth listeners once before rendering (storage, BroadcastChannel, WS events)
authActions.initStore();

// Mount the app with QueryClient and Router
render(
    () => {
        // 2. Registramos el Service Worker de forma segura cuando el cliente se monte
        onMount(() => {
            if ('serviceWorker' in navigator) {
                window.addEventListener('load', () => {
                    navigator.serviceWorker
                        .register('/pwabuilder-sw.js')
                        .then((reg) => console.log('🚀 Zelys SW registrado con éxito:', reg.scope))
                        .catch((err) => console.error('❌ Error al registrar el SW:', err));
                });

                let refreshing = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (refreshing) return;
      refreshing = true;
      
      // Usando sonner o tu sistema de alertas:
      toast.info("Zelys se ha actualizado", {
        description: "Hay mejoras disponibles. Haz clic aquí para actualizar.",
        action: {
          label: "Recargar",
          onClick: () => window.location.reload()
        },
        duration: Infinity // No desaparece hasta que actúe
      });
    });
            }
        });

        // 3. Retornamos los providers exactamente como los tenías
        return (
            <QueryClientProvider client={queryClient}>
                <ThemeProvider>
                    <RouterApp />
                    <Toaster position="top-right" richColors />
                </ThemeProvider>
            </QueryClientProvider>
        );
    },
    root!
);