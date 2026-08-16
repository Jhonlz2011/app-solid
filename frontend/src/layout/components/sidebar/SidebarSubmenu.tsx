import { Component, For, createMemo, Show } from 'solid-js';
import { LockIcon } from '@shared/ui/icons';
import { Link } from '@tanstack/solid-router';
import type { MenuItem } from './types';
import { useSidebar } from './SidebarContext';

interface SidebarSubmenuProps {
    items: MenuItem[];
    expanded: boolean;
}

export const SidebarSubmenu: Component<SidebarSubmenuProps> = (props) => {
    const { isActive, isMobileOpen, setIsMobileOpen } = useSidebar();

    return (
        <div
            class="grid transition-[grid-template-rows] duration-300 ease-in-out"
            classList={{
                'grid-rows-[0fr]': !props.expanded,
                'grid-rows-[1fr]': props.expanded
            }}
        >
            <div class="overflow-hidden">
                {/* Container with continuous vertical track line */}
                <div class="relative ml-6 mt-1 pl-2">
                    {/* Continuous vertical track line (background) */}
                    <div class="absolute left-0 top-0 bottom-0 w-0.5 bg-border/50 rounded-xl" />

                    {/* Submenu items */}
                    <ul role="menu" aria-label="Submenú" class="space-y-0.5">
                        <For each={props.items}>
                            {(child) => {
                                const isChildActive = createMemo(() => isActive(child.path));
                                const isDevelopment = child.status === 'development';

                                return (
                                    <li role="none" class="relative">
                                        {/* Active indicator - glowing segment on the track */}
                                        <span
                                            class="absolute -left-2 top-1/2 -translate-y-1/2 w-0.5 rounded-sm"
                                            classList={{
                                                'h-9.5 bg-primary shadow-[0_0_8px_var(--color-primary)]': isChildActive() && !isDevelopment,
                                                'h-0 bg-transparent': !isChildActive() || isDevelopment
                                            }}
                                        />

                                        <Link
                                            to={child.path || '#'}
                                            role="menuitem"
                                            tabIndex={props.expanded && !isDevelopment ? 0 : -1}
                                            data-active={(isChildActive() && !isDevelopment) ? 'true' : undefined}
                                            disabled={isDevelopment}
                                            onClick={(e) => {
                                                if (isDevelopment) {
                                                    e.preventDefault();
                                                    return;
                                                }
                                                if (isMobileOpen()) setIsMobileOpen(false);
                                            }}
                                            class={`group flex items-center justify-between gap-2 py-2.5 px-3 rounded-xl text-sm transition-all duration-200 ${
                                                isDevelopment 
                                                    ? 'text-muted/50 cursor-not-allowed bg-transparent' 
                                                    : 'text-muted hover:text-heading hover:bg-primary/8 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-inset data-[active=true]:text-primary-strong data-[active=true]:font-medium data-[active=true]:bg-primary/10 focus-visible:text-heading'
                                            }`}
                                        >
                                            <div class="flex items-center gap-2 truncate">
                                                {/* Icon */}
                                                <svg
                                                    class="size-4 shrink-0 opacity-60 transition-opacity
                                                           group-hover:opacity-100 
                                                           group-data-[active=true]:opacity-100"
                                                    fill="none"
                                                    stroke="currentColor"
                                                    viewBox="0 0 24 24"
                                                >
                                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d={child.icon} />
                                                </svg>
                                                {/* Label */}
                                                <span class="truncate">{child.label}</span>
                                            </div>
                                            {/* Lock Icon for development items */}
                                            <Show when={isDevelopment}>
                                                <div class="flex items-center justify-center size-5 bg-card/50 rounded border border-border/50 shrink-0 shadow-xs group-hover:bg-card group-hover:border-border/80 transition-colors">
                                                    <LockIcon class="size-3 text-muted/60" />
                                                </div>
                                            </Show>
                                        </Link>
                                    </li>
                                );
                            }}
                        </For>
                    </ul>
                </div>
            </div>
        </div>
    );
};
