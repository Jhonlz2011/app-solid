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
            {/* Sidebar Skeleton */}
            <div class="w-64 h-full hidden sm:flex flex-col border-r border-border bg-surface shrink-0">
               
               {/* Header: App Logo + Toggles (Matches SidebarHeader) */}
               <div class="flex items-center justify-between h-20 px-4 sm:pl-5 sm:pr-4 border-b border-border shrink-0">
                   <div class="flex items-center min-w-0">
                       <Skeleton class="size-10 rounded-xl shrink-0" />
                       <div class="flex flex-col justify-center ml-3 space-y-1.5">
                           <Skeleton class="h-5 w-16 rounded" />
                           <Skeleton class="h-3 w-20 rounded" />
                       </div>
                   </div>
                   <div class="flex items-center gap-2 shrink-0">
                       <Skeleton class="size-6 rounded-lg opacity-80" />
                       <Skeleton class="size-6 rounded-lg opacity-80" />
                   </div>
               </div>

               {/* Navigation Links (Matches SidebarNav + SidebarNavItem) */}
               <div class="flex-1 flex flex-col gap-1 px-3 py-4 overflow-hidden">
                   {/* Selected Link */}
                   <div class="w-full flex items-center gap-3 h-11 px-4 rounded-xl relative">
                       <Skeleton class="size-5 rounded shrink-0 opacity-100" />
                       <Skeleton class="h-4 w-32 rounded opacity-100" />
                   </div>
                   
                   {/* Normal Links */}
                   {Array.from({ length: 8 }, () => (
                       <div class="w-full flex items-center gap-3 h-11 px-4 rounded-xl relative">
                           <Skeleton class="size-5 rounded shrink-0 opacity-60" />
                           <Skeleton class="h-4 w-28 rounded opacity-60" />
                           <Skeleton class="size-3 w-3 rounded shrink-0 ml-auto opacity-40 xl:mr-2" />
                       </div>
                   ))}
               </div>

               {/* Footer: User Profile (Matches SidebarFooter) */}
               <div class="flex items-center justify-between h-20 px-4 sm:pl-5 sm:pr-4 border-t border-border shrink-0">
                   <div class="flex items-center flex-1 min-w-0">
                       <Skeleton class="size-10 rounded-xl shrink-0" />
                       <div class="flex-1 min-w-0 ml-3 space-y-1.5">
                           <Skeleton class="h-4 w-24 rounded" />
                           <Skeleton class="h-3 w-20 rounded" />
                       </div>
                   </div>
                   <Skeleton class="size-8 rounded-xl shrink-0 opacity-60" />
               </div>
            </div>
            
            {/* Main Content Area */}
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