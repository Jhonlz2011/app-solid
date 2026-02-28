import { Component } from 'solid-js';
import { Outlet, useLocation } from '@tanstack/solid-router';
import { Sidebar } from './components/sidebar';
import MobileHeader from './components/MobileHeader';
import { scrollBar } from '@shared/directives/scroll';
import { Skeleton } from '@shared/ui/Skeleton';

// Preserve directive from tree-shaking
void scrollBar;

export const LayoutSkeleton: Component = () => {
    return (
        <div class="flex h-screen bg-background overflow-hidden relative">
            <div class="w-64 h-full hidden sm:block border-r border-border bg-surface p-4 space-y-4 shrink-0">
               <Skeleton class="h-10 w-full rounded-lg mb-8" />
               <Skeleton class="h-8 w-full rounded-lg" />
               <Skeleton class="h-8 w-full rounded-lg" />
               <Skeleton class="h-8 w-full rounded-lg" />
               <Skeleton class="h-8 w-full rounded-lg" />
               <Skeleton class="h-8 w-full rounded-lg" />
            </div>
            <main class="flex-1 relative min-w-0 bg-background pt-14 sm:pt-0" />
        </div>
    );
};

const MainLayout: Component = () => {
    const location = useLocation();

    return (
        <div class="flex h-screen bg-background overflow-hidden relative">
            <MobileHeader />
            <Sidebar />

            <main
                use:scrollBar={location().pathname}
                class="flex-1 relative min-w-0 bg-background"
            >
                <div class="flex flex-col min-h-full pt-14 sm:pt-0 overflow-hidden relative">
                    <Outlet />
                </div>
            </main>
        </div>
    );
};

export default MainLayout;