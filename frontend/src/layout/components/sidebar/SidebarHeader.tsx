import { Component, Show } from 'solid-js';
import { useSidebar } from './SidebarContext';
import { SidebarCollapseIcon } from '@icons/SidebarCollapseIcon';
import { CloseIcon } from '@icons/CloseIcon';
import { CompanySwitcher } from '@shared/ui/CompanySwitcher';

interface SidebarHeaderProps {
    toggleCollapse: () => void;
}

export const SidebarHeader: Component<SidebarHeaderProps> = (props) => {
    const { collapsed, setIsMobileOpen } = useSidebar();

    return (
        <header
            class="border-b border-border relative h-18 shrink-0 flex items-center px-3 justify-between gap-1"
            data-collapsed={collapsed()}
        >
            <div class="flex-1 min-w-0 flex items-center">
                <CompanySwitcher collapsed={collapsed()} />
            </div>

            {/* Right side buttons */}
            <div class="flex items-center gap-1 shrink-0">
                <Show when={!collapsed()}>
                    <button
                        onClick={props.toggleCollapse}
                        class="hidden sm:flex items-center justify-center text-muted hover:bg-card-alt hover:text-heading p-1.5 rounded-lg
                               focus-visible:text-heading focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 cursor-pointer transition-colors"
                        title="Colapsar sidebar"
                        aria-label="Colapsar sidebar"
                    >
                        <SidebarCollapseIcon class="size-4.5" />
                    </button>
                </Show>

                {/* Close button - Mobile only */}
                <button
                    onClick={() => setIsMobileOpen(false)}
                    class="sm:hidden text-muted hover:bg-card-alt hover:text-heading p-1.5 rounded-xl 
                           focus:outline-none focus-visible:ring-2 focus-visible:ring-primary cursor-pointer transition-colors"
                    aria-label="Cerrar menú"
                >
                    <CloseIcon class="size-5" />
                </button>
            </div>
        </header>
    );
};

