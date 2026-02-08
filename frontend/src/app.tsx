
/* @refresh reload */
import { render } from 'solid-js/web';
import 'solid-devtools';
import './index.css';

import { RouterApp } from './router';
import { QueryClientProvider } from '@tanstack/solid-query';
import { queryClient } from './shared/lib/queryClient';
import { ThemeProvider } from './contexts/ThemeContext';
import { Toaster } from 'solid-sonner';

const root = document.getElementById('root');

if (import.meta.env.DEV && !(root instanceof HTMLElement)) {
    throw new Error(
        'Root element not found. Did you forget to add it to your index.html? Or maybe the id attribute got misspelled?',
    );
}
// Mount the app with QueryClient and Router
render(
    () => (
        <QueryClientProvider client={queryClient}>
            <ThemeProvider>
                <RouterApp />
                <Toaster position="top-right" richColors />
            </ThemeProvider>
        </QueryClientProvider>
    ),
    root!
);