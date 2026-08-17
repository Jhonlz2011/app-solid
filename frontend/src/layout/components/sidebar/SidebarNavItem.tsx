import { Component, Show, For, createSignal, createEffect, onCleanup, on, createMemo } from 'solid-js';
import { Portal } from 'solid-js/web';
import { Link, useLocation } from '@tanstack/solid-router';
import type { MenuItem } from './types';
import { SidebarSubmenu } from './SidebarSubmenu';
import { useSidebar } from './SidebarContext';
import { useSidebarTooltip } from './useSidebarTooltip';
import { ChevronDownIcon } from '@icons/ChevronDownIcon';
import { LockIcon } from '@icons/LockIcon';

interface SidebarNavItemProps {
    item: MenuItem;
}

export const SidebarNavItem: Component<SidebarNavItemProps> = (props) => {
    const location = useLocation();
    const {
        collapsed, expandedMenus, activeTooltipId, setActiveTooltipId,
        toggleMenu, isActive, hasActiveDescendant, isMobileOpen, setIsMobileOpen
    } = useSidebar();

    const hasChildren = () => Boolean(props.item.children?.length);
    const isExpanded = () => expandedMenus().has(props.item.id);

    // Auto-expand logic - tracks location changes and sidebar expansion
    createEffect(on(
        () => [location().pathname, collapsed()],
        () => {
            if (!collapsed() && hasChildren() && hasActiveDescendant(props.item) && !isExpanded()) {
                toggleMenu(props.item.id);
            }
        },
        { defer: true }
    ));

    // --- TOOLTIP LOGIC ---
    const tooltip = useSidebarTooltip(props.item.id);
    let focusTimeout: ReturnType<typeof setTimeout>;

    onCleanup(() => {
        clearTimeout(focusTimeout);
    });

    const focusFirstTooltipLink = () => {
        focusTimeout = setTimeout(() => {
            const firstLink = tooltip.getTooltipRef()?.querySelector('a') as HTMLAnchorElement | null;
            firstLink?.focus();
        }, 50);
    };

    // --- RENDER LOGIC ---
    const dataState = createMemo(() => {
        if (isActive(props.item.path)) return 'active';
        if (hasChildren() && hasActiveDescendant(props.item)) {
            return collapsed() || !isExpanded() ? 'active' : 'parent-active';
        }
        return 'default';
    });

    // Toggle submenu for items with children
    const handleToggleSubmenu = () => {
        if (props.item.status === 'development') return;
        if (hasChildren() && !collapsed()) {
            toggleMenu(props.item.id);
        }
    };

    // Keyboard Handler
    const handleKeyDown = (e: KeyboardEvent) => {
        if (props.item.status === 'development') {
            if (e.key === 'Enter' || e.key === ' ') e.preventDefault();
            return;
        }

        if (collapsed()) {
            if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowRight') {
                e.preventDefault();
                if (hasChildren()) {
                    tooltip.handleMouseEnter();
                    focusFirstTooltipLink();
                }
                // For items without children, let the Link handle navigation
            } else if (e.key === 'Escape' || e.key === 'ArrowLeft') {
                e.preventDefault();
                tooltip.hideTooltip();
            }
            return;
        }

        // Expanded state: toggle submenu
        if (hasChildren() && (e.key === 'Enter' || e.key === ' ')) {
            e.preventDefault();
            handleToggleSubmenu();
        }
    };

    const handleTooltipFocusOut = (e: FocusEvent) => {
        const relatedTarget = e.relatedTarget as HTMLElement | null;
        const isInsideTooltip = tooltip.getTooltipRef()?.contains(relatedTarget);
        const isInsideItem = tooltip.getTriggerRef()?.contains(relatedTarget);
        if (!isInsideTooltip && !isInsideItem) {
            tooltip.hideTooltip();
        }
    };

    const isDevelopment = props.item.status === 'development';

    // Base classes for the interactive element
    const baseClasses = `group w-full flex items-center gap-3 h-11 px-4 rounded-xl relative
        text-muted transition-colors duration-200
        ${isDevelopment 
            ? 'opacity-60 cursor-not-allowed grayscale' 
            : 'hover:bg-primary/8 hover:text-heading focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-1 focus-visible:ring-offset-bg focus-visible:text-text'
        }`;

    const activeClasses = isDevelopment ? '' : `data-[state=active]:bg-primary/12 data-[state=active]:text-primary-strong data-[state=active]:font-semibold
        data-[state=active]:shadow-[inset_3px_0_0_var(--color-primary-strong)]
        data-[state=parent-active]:text-primary-strong`;

    return (
        <li class="relative">
            {/* Use Link for items without children (navigable), button for parent items */}
            <Show
                when={!hasChildren() && props.item.path}
                fallback={
                    /* Parent item with children - uses button */
                    <button
                        ref={tooltip.setTriggerRef}
                        type="button"
                        data-state={dataState()}
                        onClick={handleToggleSubmenu}
                        onKeyDown={handleKeyDown}
                        onMouseEnter={tooltip.handleMouseEnter}
                        onMouseLeave={tooltip.handleMouseLeave}
                        class={`${baseClasses} ${activeClasses} cursor-pointer`}
                    >
                        {/* Icon Container */}
                        <div class="flex items-center justify-center size-5 shrink-0">
                            <svg class="size-5 opacity-70 group-hover:opacity-100 group-data-[state=active]:opacity-100 transition-opacity" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d={props.item.icon} />
                            </svg>
                        </div>
                        {/* Text Container */}
                        <div
                            class="flex-1 flex items-center justify-between overflow-hidden transition-[opacity,max-width] duration-300 ease-[cubic-bezier(0.2,0,0,1)]"
                            classList={{
                                'opacity-100 max-w-[200px]': !collapsed(),
                                'opacity-0 max-w-0': collapsed()
                            }}
                        >
                            <span class="whitespace-nowrap">{props.item.label}</span>
                            <div class="flex items-center gap-2">
                                <Show when={isDevelopment}>
                                    <div class="flex items-center justify-center size-5 bg-card/50 rounded border border-border/50 shrink-0 shadow-xs">
                                        <LockIcon class="size-3 text-muted/60" />
                                    </div>
                                </Show>
                                <ChevronDownIcon
                                    class={`size-4 shrink-0 opacity-50 group-hover:opacity-80 transition-transform duration-300 ${isExpanded() ? 'rotate-180' : ''}`}
                                />
                            </div>
                        </div>
                    </button>
                }
            >
                {/* Navigable item - uses Link (supports right-click open in new tab) */}
                <Link
                    to={props.item.path!}
                    ref={tooltip.setTriggerRef}
                    data-state={dataState()}
                    onClick={() => {
                        if (isMobileOpen()) setIsMobileOpen(false);
                    }}
                    onKeyDown={handleKeyDown}
                    onMouseEnter={tooltip.handleMouseEnter}
                    onMouseLeave={tooltip.handleMouseLeave}
                    class={`${baseClasses} ${activeClasses}`}
                >
                    {/* Icon Container */}
                    <div class="flex items-center justify-center size-5 shrink-0">
                        <svg class="size-5 opacity-70 group-hover:opacity-100 group-data-[state=active]:opacity-100 transition-opacity" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d={props.item.icon} />
                        </svg>
                    </div>

                    {/* Text Container */}
                    <div
                        class="flex-1 flex items-center justify-between overflow-hidden transition-[opacity,max-width] duration-300 ease-[cubic-bezier(0.2,0,0,1)]"
                        classList={{
                            'opacity-100 max-w-[200px]': !collapsed(),
                            'opacity-0 max-w-0': collapsed()
                        }}
                    >
                        <span class="whitespace-nowrap">{props.item.label}</span>
                        <Show when={isDevelopment}>
                            <div class="flex items-center justify-center size-5 bg-card/50 rounded border border-border/50 shrink-0 shadow-xs">
                                <LockIcon class="size-3 text-muted/60" />
                            </div>
                        </Show>
                    </div>
                </Link>
            </Show>

            {/* Submenu (expanded mode) */}
            <Show when={hasChildren() && !collapsed()}>
                <SidebarSubmenu
                    items={props.item.children!}
                    expanded={isExpanded()}
                />
            </Show>

            {/* Tooltip Portal (collapsed mode) */}
            <Show when={tooltip.shouldShowTooltip()}>
                <Portal>
                    <div
                        ref={tooltip.setTooltipRef}
                        class="fixed z-9999 min-w-45 p-2 bg-surface backdrop-blur-lg border border-border/80 rounded-xl shadow-2xl
                               animate-in fade-in slide-in-from-left-2 duration-150"
                        style={{ top: `${tooltip.tooltipRect()?.top}px`, left: `${tooltip.tooltipRect()?.left}px`, transform: 'translateY(-50%)' }}
                        onMouseEnter={tooltip.cancelHide}
                        onMouseLeave={tooltip.handleMouseLeave}
                        onFocusOut={handleTooltipFocusOut}
                        onKeyDown={(e) => {
                            if (e.key === 'Escape' || e.key === 'ArrowLeft') {
                                e.preventDefault();
                                tooltip.hideTooltip();
                                tooltip.getTriggerRef()?.focus();
                            }
                        }}
                    >
                        {/* Tooltip Header */}
                        <div class="px-2 py-1.5 mb-1 font-semibold text-sm text-heading border-b border-border/50">
                            {props.item.label}
                        </div>

                        {/* Tooltip Links - using <a> for right-click support */}
                        <Show when={hasChildren()}>
                            <ul class="space-y-0.5" role="menu">
                                <For each={props.item.children!}>
                                    {(child) => {
                                        const isChildDev = child.status === 'development';
                                        return (
                                        <li role="none">
                                            <Link
                                                to={child.path || '#'}
                                                role="menuitem"
                                                onClick={(e) => {
                                                    if (isChildDev) {
                                                        e.preventDefault();
                                                        return;
                                                    }
                                                    tooltip.hideTooltip();
                                                    if (isMobileOpen()) setIsMobileOpen(false);
                                                }}
                                                onKeyDown={(e: KeyboardEvent) => {
                                                    const links = Array.from(tooltip.getTooltipRef()?.querySelectorAll('a[role="menuitem"]') || []) as HTMLAnchorElement[];
                                                    const currentIndex = links.indexOf(e.currentTarget! as HTMLAnchorElement);
                                                    const isFirst = currentIndex === 0;
                                                    const isLast = currentIndex === links.length - 1;

                                                    if (e.key === 'ArrowDown') {
                                                        e.preventDefault();
                                                        links[(currentIndex + 1) % links.length]?.focus();
                                                    } else if (e.key === 'ArrowUp') {
                                                        e.preventDefault();
                                                        links[currentIndex === 0 ? links.length - 1 : currentIndex - 1]?.focus();
                                                    } else if (e.key === 'Tab') {
                                                        if (e.shiftKey && isFirst) {
                                                            e.preventDefault();
                                                            links[links.length - 1]?.focus();
                                                        } else if (!e.shiftKey && isLast) {
                                                            e.preventDefault();
                                                            links[0]?.focus();
                                                        }
                                                    } else if (e.key === 'Escape' || e.key === 'ArrowLeft') {
                                                        e.preventDefault();
                                                        tooltip.hideTooltip();
                                                        tooltip.getTriggerRef()?.focus();
                                                    }
                                                }}
                                                class={`flex justify-between z-100 items-center gap-2 px-2 py-2 rounded-lg text-sm transition-all ${
                                                    isChildDev
                                                        ? 'text-muted/50 cursor-not-allowed bg-transparent'
                                                        : (isActive(child.path) ? 'bg-primary/10 text-primary-strong font-medium' : 'text-muted hover:bg-primary/10 hover:text-heading focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-inset focus-visible:text-heading')
                                                }`}
                                            >
                                                <div class="flex items-center gap-2 truncate">
                                                    <svg class="size-4 shrink-0 opacity-70" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d={child.icon} />
                                                    </svg>
                                                    <span class="truncate">{child.label}</span>
                                                </div>
                                                <Show when={isChildDev}>
                                                    <div class="flex items-center justify-center size-4 bg-card/50 rounded border border-border/50 shrink-0">
                                                        <LockIcon class="size-2.5 text-muted/60" />
                                                    </div>
                                                </Show>
                                            </Link>
                                        </li>
                                        );
                                    }}
                                </For>
                            </ul>
                        </Show>

                        {/* Arrow indicator */}
                        <div class="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-1.5 w-3 h-3 bg-surface border-l border-b border-border/80 rotate-45 z-0" />
                    </div>
                </Portal>
            </Show>
        </li>
    );
};