import { Component, Show } from 'solid-js';
import ThemeToggle from '../ThemeToggle';
import { useSidebar } from './SidebarContext';
import { SidebarCollapseIcon, CloseIcon } from '@shared/ui/icons';

interface SidebarHeaderProps {
    toggleCollapse: () => void;
}

export const SidebarHeader: Component<SidebarHeaderProps> = (props) => {
    const { collapsed, setIsMobileOpen } = useSidebar();

    return (
        <header
            class="border-b border-border relative h-20 shrink-0"
            data-collapsed={collapsed()}
        >
            {/* Logo Layer - Always visible */}
            <div class="absolute inset-0 flex items-center px-4 sm:pl-5 pointer-events-none">
                <div class="size-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center shrink-0">
                    <span class="text-white font-bold text-lg">A</span>
                </div>
            </div>

            {/* Collapsed Content - Expand button on hover */}
            <div
                class="absolute inset-0 flex items-center px-4 sm:pl-5 transition-opacity duration-200"
                classList={{
                    'opacity-100': collapsed(),
                    'opacity-0 pointer-events-none': !collapsed()
                }}
                inert={!collapsed()}
            >
                <div class="relative size-10 shrink-0">
                    <button
                        onClick={props.toggleCollapse}
                        class="peer absolute inset-0 size-10 hidden sm:flex items-center justify-center 
                               opacity-0 hover:opacity-100 focus-visible:opacity-100 
                               rounded-xl hover:bg-card-alt
                               focus:outline-none focus-visible:bg-card-alt focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 focus-visible:ring-offset-transparent
                               z-10 pointer-events-auto hover:scale-102 focus-visible:scale-102"
                        title="Expandir sidebar"
                        aria-label="Expandir sidebar"
                    >
                        <SidebarCollapseIcon class="size-5" />
                    </button>
                </div>
            </div>

            {/* Expanded Content - Text and buttons */}
            <div
                class="absolute inset-0 flex items-center justify-between px-4 sm:pl-5 sm:pr-4 transition-opacity duration-200"
                classList={{
                    'opacity-100': !collapsed(),
                    'opacity-0 pointer-events-none': collapsed()
                }}
                inert={collapsed()}
            >
                {/* Logo + Text */}
                <div class="flex items-center gap-3 min-w-0">
                    <div class="size-10 shrink-0 opacity-0" /> {/* Spacer */}
                    <div class="flex flex-col justify-center overflow-hidden">
                        <h2 class="font-bold text-lg whitespace-nowrap">App</h2>
                        <p class="text-muted text-xs whitespace-nowrap">Dashboard</p>
                    </div>
                </div>

                {/* Right side buttons */}
                <div class="flex items-center gap-2">
                    <ThemeToggle collapsed={collapsed()} />

                    <Show when={!collapsed()}>
                        <button
                            onClick={props.toggleCollapse}
                            class="hidden sm:flex items-center justify-center text-muted hover:bg-card-alt hover:text-heading p-2 rounded-lg
                                   focus-visible:text-heading focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 focus-visible:ring-offset-transparent"
                            title="Colapsar sidebar"
                            aria-label="Colapsar sidebar">
                            <SidebarCollapseIcon class="size-5" />
                        </button>
                    </Show>

                    {/* Close button - Mobile only */}
                    <button onClick={() => setIsMobileOpen(false)}
                        class="sm:hidden text-muted hover:bg-card-alt hover:text-heading p-2 rounded-xl 
                               focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-inset"
                        aria-label="Cerrar menú">
                        <CloseIcon class="size-6" />
                    </button>
                </div>
            </div>
        </header>
    );
};
