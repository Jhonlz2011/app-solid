import { Component, For, Show, createEffect } from 'solid-js';
import { Outlet } from '@tanstack/solid-router';
import { Sidebar } from './components/sidebar';
import MobileHeader from './components/MobileHeader';
import { Skeleton } from '@shared/ui/Skeleton';
import { useOnlineStatus } from '@shared/hooks/useOnlineStatus';
import { OfflineBanner } from '@shared/ui/OfflineBanner';
import { toast } from 'solid-sonner';

export const LayoutSkeleton: Component = () => {
    return (
        <div class="flex h-dvh bg-background overflow-hidden relative">
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
                    <For each={Array(8).fill(null)}>
                        {() => (
                            <div class="w-full flex items-center gap-3 h-11 px-4 rounded-xl relative">
                                <Skeleton class="size-5 rounded shrink-0 opacity-60" />
                                <Skeleton class="h-4 w-28 rounded opacity-60" />
                                <Skeleton class="size-3 w-3 rounded shrink-0 ml-auto opacity-40 xl:mr-2" />
                            </div>
                        )}
                    </For>
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
    const isOnline = useOnlineStatus();

    // Notificaciones reactivas cuando la conexión cambia de estado
    createEffect((prev) => {
        const current = isOnline();
        if (prev !== undefined && current !== prev) {
            if (current) {
                toast.success('Conexión restablecida', {
                    description: 'Se ha recuperado el acceso a internet. Sincronizando datos con el servidor...',
                    duration: 4000,
                });
            } else {
                toast.error('Sin conexión a internet', {
                    description: 'Zelys ha cambiado a modo local. Puedes seguir usando la app sin problemas.',
                    duration: 5000,
                });
            }
        }
        return current;
    }, isOnline());

    return (
        <div class="flex h-dvh bg-background overflow-hidden relative">
            <MobileHeader />
            <Sidebar />

            <main class="flex-1 relative min-w-0 bg-background overflow-hidden">
                <div class="flex flex-col h-full pt-14 sm:pt-0 overflow-hidden relative min-h-0">
                    <Show when={!isOnline()}>
                        <OfflineBanner />
                    </Show>
                    <div class="flex-1 min-h-0 relative">
                        <Outlet />
                    </div>
                </div>
            </main>
        </div>
    );
};

export default MainLayout;