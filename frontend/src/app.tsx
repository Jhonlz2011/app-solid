
/* @refresh reload */
import { render } from 'solid-js/web';
import { onMount } from 'solid-js';
import 'solid-devtools';
import './index.css';

import { RouterApp } from './router';
import { PersistQueryClientProvider } from '@tanstack/solid-query-persist-client';
import { queryClient, persister } from './shared/lib/queryClient';
import { ThemeProvider } from './contexts/ThemeContext';
import { Toaster, toast } from 'solid-sonner';
import { useRegisterSW } from 'virtual:pwa-register/solid';

import { actions as authActions } from './modules/auth/store/auth.store';
import { brandingActions } from './modules/auth/store/branding.store';

// --- REDIRECT SESSION HANDLER FOR CROSS-SUBDOMAIN LOCAL STORAGE ---
if (typeof window !== 'undefined') {
    const params = new URLSearchParams(window.location.search);
    if (params.get('session') === 'true') {
        localStorage.setItem('hasSession', 'true');
        params.delete('session');
        const newSearch = params.toString();
        const cleanUrl = window.location.pathname + (newSearch ? `?${newSearch}` : '') + window.location.hash;
        window.history.replaceState({}, '', cleanUrl);
    }
}

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
        // Registro reactivo de Service Worker y detección de actualizaciones
        const {
            needRefresh: [needRefresh],
            offlineReady: [offlineReady],
            updateServiceWorker,
        } = useRegisterSW({
            onRegistered(r) {
                console.log('🚀 Service Worker registrado con éxito en Zelys:', r?.scope);
            },
            onRegisterError(error) {
                console.error('❌ Error al registrar el Service Worker:', error);
            },
        });

        // Disparar toasts reactivos basados en estados del SW
        onMount(() => {
            brandingActions.loadBranding();
            if (offlineReady()) {
                toast.success('Zelys está listo para trabajar sin conexión.');
            }

            if (needRefresh()) {
                toast.info('Nueva versión de Zelys disponible', {
                    description: 'Se han realizado optimizaciones. Haz clic para actualizar.',
                    duration: Infinity,
                    action: {
                        label: 'Actualizar',
                        onClick: () => {
                            updateServiceWorker(true);
                        }
                    }
                });
            }
        });

        return (
            <PersistQueryClientProvider 
                client={queryClient} 
                persistOptions={{ 
                    persister,
                    dehydrateOptions: {
                        shouldDehydrateMutation: (mutation) => {
                            // Solo persistir mutaciones que tengan un mutationKey estructurado
                            return !!mutation.options.mutationKey;
                        }
                    },
                }}
                onSuccess={() => {
                    // Al hidratar exitosamente la caché de IndexedDB, reanudar mutaciones en cola
                    queryClient.resumePausedMutations().then(() => {
                        queryClient.invalidateQueries();
                    });
                }}
            >
                <ThemeProvider>
                    <RouterApp />
                    <Toaster offset={6} position="top-center" richColors />
                </ThemeProvider>
            </PersistQueryClientProvider>
        );
    },
    root!
);