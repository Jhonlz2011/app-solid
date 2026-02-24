import { Component } from 'solid-js';
import { Outlet, useLocation } from '@tanstack/solid-router';
import { Sidebar } from './components/sidebar';
import MobileHeader from './components/MobileHeader';
import { scrollBar } from '@shared/directives/scroll';

// Preserve directive from tree-shaking
void scrollBar;

const MainLayout: Component = () => {
    const location = useLocation();

    return (
        <div class="flex h-screen bg-background overflow-hidden">
            <MobileHeader />
            <Sidebar />

            <main
                use:scrollBar={location().pathname}
                class="flex-1 relative min-w-0 bg-background"
            >
                <div class="flex flex-col min-h-full pt-14 sm:pt-0 overflow-hidden">
                    <Outlet />
                </div>
            </main>
        </div>
    );
};

export default MainLayout;