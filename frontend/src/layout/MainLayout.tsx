import { ParentComponent } from 'solid-js';
import { Outlet, useLocation } from '@tanstack/solid-router'; // Importar useLocation
import { Sidebar } from './components/sidebar';
import MobileHeader from './components/MobileHeader';
import { scrollBar } from '@shared/directives/scroll';

// Registrar directiva para TS
false && scrollBar;

const MainLayout: ParentComponent = () => {
    const location = useLocation(); // Hook para detectar cambios de ruta

    return (
        <div class="flex h-screen bg-background overflow-hidden">
            <MobileHeader />
            <Sidebar />

            {/* Main Content Area */}
            <main
                // Pasamos location.pathname como dependencia para el reset de scroll
                use:scrollBar={location().pathname}
                class="flex-1 relative min-w-0 bg-background"
            >
                {/* IMPORTANTE: 
                   El padding top para mobile (pt-14) debe estar DENTRO del scroll,
                   o en el contenedor hijo, no en el main que tiene el SimpleBar,
                   para evitar problemas de cálculo de altura.
                   
                   Sugerencia: Muévelo al Outlet o a un wrapper interno si es posible,
                   o déjalo aquí si SimpleBar lo maneja bien visualmente.
                */}
                <div class="flex flex-col min-h-full pt-14 sm:pt-0 overflow-hidden">
                    <Outlet />
                </div>
            </main>
        </div>
    );
};

export default MainLayout;