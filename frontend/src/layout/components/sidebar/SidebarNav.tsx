import { Component, For } from 'solid-js';
import type { MenuItem } from './types';
import { SidebarNavItem } from './SidebarNavItem';
import { scrollBar } from '@shared/directives/scroll';

// Register directive
false && scrollBar;

interface SidebarNavProps {
    items: MenuItem[];
}

export const SidebarNav: Component<SidebarNavProps> = (props) => {
    return (
        <nav
            role="navigation"
            aria-label="Navegación principal"
            class="flex-1 min-h-0 px-3 pb-3 pt-1.5"
            use:scrollBar={true}
            style={{ 'content-visibility': 'auto' }}
        >
            <ul role="menu" class="space-y-1">
                <For each={props.items}>
                    {(item) => (
                        <SidebarNavItem item={item} />
                    )}
                </For>
            </ul>
        </nav>
    );
};
