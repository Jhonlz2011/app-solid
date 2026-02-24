import { Component, Show, For, createSignal, createEffect, onCleanup, on } from 'solid-js';
import { Portal } from 'solid-js/web';
import { Link, useLocation } from '@tanstack/solid-router';
import type { MenuItem } from './types';
import { SidebarSubmenu } from './SidebarSubmenu';
import { useSidebar } from './SidebarContext';
import { ChevronDownIcon } from '@shared/ui/icons';

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

    // Auto-expand logic - only tracks location changes with defer
    createEffect(on(
        () => location().pathname,
        () => {
            if (!collapsed() && hasChildren() && hasActiveDescendant(props.item) && !isExpanded()) {
                toggleMenu(props.item.id);
            }
        },
        { defer: true }
    ));

    // --- TOOLTIP LOGIC ---
    const [tooltipRect, setTooltipRect] = createSignal<{ top: number, left: number } | null>(null);
    let itemRef: HTMLElement | undefined;
    let tooltipRef: HTMLDivElement | undefined;
    let hoverTimeout: ReturnType<typeof setTimeout>;
    let focusTimeout: ReturnType<typeof setTimeout>;

    onCleanup(() => {
        clearTimeout(hoverTimeout);
        clearTimeout(focusTimeout);
    });

    const focusFirstTooltipLink = () => {
        focusTimeout = setTimeout(() => {
            const firstLink = tooltipRef?.querySelector('a') as HTMLAnchorElement | null;
            firstLink?.focus();
        }, 50);
    };

    const handleMouseEnter = () => {
        if (!collapsed()) return;
        clearTimeout(hoverTimeout);
        if (itemRef) {
            const rect = itemRef.getBoundingClientRect();
            setTooltipRect({ top: rect.top + rect.height / 2, left: rect.right + 12 });
        }
        setActiveTooltipId(props.item.id);
    };

    const handleMouseLeave = () => {
        if (!collapsed()) return;
        hoverTimeout = setTimeout(() => {
            if (activeTooltipId() === props.item.id) setActiveTooltipId(null);
        }, 150);
    };

    // --- RENDER LOGIC ---
    const dataState = () => {
        if (isActive(props.item.path)) return 'active';
        if (hasChildren() && hasActiveDescendant(props.item)) {
            return collapsed() || !isExpanded() ? 'active' : 'parent-active';
        }
        return 'default';
    };

    // Toggle submenu for items with children
    const handleToggleSubmenu = () => {
        if (hasChildren() && !collapsed()) {
            toggleMenu(props.item.id);
        }
    };

    // Keyboard Handler
    const handleKeyDown = (e: KeyboardEvent) => {
        if (collapsed()) {
            if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowRight') {
                e.preventDefault();
                if (hasChildren()) {
                    if (itemRef) {
                        const rect = itemRef.getBoundingClientRect();
                        setTooltipRect({ top: rect.top + rect.height / 2, left: rect.right + 12 });
                    }
                    setActiveTooltipId(props.item.id);
                    focusFirstTooltipLink();
                }
                // For items without children, let the Link handle navigation
            } else if (e.key === 'Escape' || e.key === 'ArrowLeft') {
                e.preventDefault();
                setActiveTooltipId(null);
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
        const isInsideTooltip = tooltipRef?.contains(relatedTarget);
        const isInsideItem = itemRef?.contains(relatedTarget);
        if (!isInsideTooltip && !isInsideItem) {
            setActiveTooltipId(null);
        }
    };

    const shouldShowTooltip = () => collapsed() && activeTooltipId() === props.item.id && tooltipRect();

    // Base classes for the interactive element
    const baseClasses = `group w-full flex items-center gap-3 h-11 px-4 rounded-xl relative
        text-muted transition-colors duration-200
        hover:bg-primary/8 hover:text-heading
        focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 focus-visible:ring-offset-transparent focus-visible:text-text`;

    const activeClasses = `data-[state=active]:bg-primary/12 data-[state=active]:text-primary-strong data-[state=active]:font-semibold
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
                        ref={el => itemRef = el}
                        type="button"
                        data-state={dataState()}
                        onClick={handleToggleSubmenu}
                        onKeyDown={handleKeyDown}
                        onMouseEnter={handleMouseEnter}
                        onMouseLeave={handleMouseLeave}
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
                            classList={{
                                'flex-1 flex items-center justify-between overflow-hidden transition-[opacity,max-width] duration-300': true,
                                'opacity-100 max-w-full': !collapsed(),
                                'opacity-0 max-w-0': collapsed()
                            }}
                        >
                            <span class="whitespace-nowrap">{props.item.label}</span>
                            <ChevronDownIcon
                                class={`size-4 shrink-0 ml-2 opacity-50 group-hover:opacity-80 transition-transform duration-300 ${isExpanded() ? 'rotate-180' : ''}`}
                            />
                        </div>
                    </button>
                }
            >
                {/* Navigable item - uses Link (supports right-click open in new tab) */}
                <Link
                    to={props.item.path!}
                    ref={el => itemRef = el}
                    data-state={dataState()}
                    onClick={() => {
                        if (isMobileOpen()) setIsMobileOpen(false);
                    }}
                    onKeyDown={handleKeyDown}
                    onMouseEnter={handleMouseEnter}
                    onMouseLeave={handleMouseLeave}
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
                        classList={{
                            'flex-1 overflow-hidden transition-[opacity,max-width] duration-300': true,
                            'opacity-100 max-w-full': !collapsed(),
                            'opacity-0 max-w-0': collapsed()
                        }}
                    >
                        <span class="whitespace-nowrap">{props.item.label}</span>
                    </div>
                </Link>
            </Show>

            {/* Submenu (expanded mode) */}
            <Show when={hasChildren() && !collapsed()}>
                <SidebarSubmenu
                    items={props.item.children!}
                    expanded={isExpanded}
                />
            </Show>

            {/* Tooltip Portal (collapsed mode) */}
            <Show when={shouldShowTooltip()}>
                <Portal>
                    <div
                        ref={el => tooltipRef = el}
                        class="fixed z-[9999] min-w-[180px] p-2 bg-surface/95 backdrop-blur-lg border border-border/80 rounded-xl shadow-2xl
                               animate-in fade-in slide-in-from-left-2 duration-150"
                        style={{ top: `${tooltipRect()?.top}px`, left: `${tooltipRect()?.left}px`, transform: 'translateY(-50%)' }}
                        onMouseEnter={() => clearTimeout(hoverTimeout)}
                        onMouseLeave={handleMouseLeave}
                        onFocusOut={handleTooltipFocusOut}
                        onKeyDown={(e) => {
                            if (e.key === 'Escape' || e.key === 'ArrowLeft') {
                                e.preventDefault();
                                setActiveTooltipId(null);
                                itemRef?.focus();
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
                                    {(child) => (
                                    <li role="none">
                                        <Link
                                            to={child.path || '#'}
                                            role="menuitem"
                                            onClick={() => {
                                                setActiveTooltipId(null);
                                                if (isMobileOpen()) setIsMobileOpen(false);
                                            }}
                                            onKeyDown={(e: KeyboardEvent) => {
                                                const links = Array.from(tooltipRef?.querySelectorAll('a[role="menuitem"]') || []) as HTMLAnchorElement[];
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
                                                    setActiveTooltipId(null);
                                                    itemRef?.focus();
                                                }
                                            }}
                                            class={`flex items-center gap-2 px-2 py-2 rounded-lg text-sm transition-all
                                                   hover:bg-primary/10 hover:text-heading
                                                   focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 focus-visible:ring-offset-transparent focus-visible:text-heading
                                                   ${isActive(child.path)
                                                    ? 'bg-primary/10 text-primary-strong font-medium'
                                                    : 'text-muted'}`}
                                        >
                                            <svg class="size-4 shrink-0 opacity-70" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d={child.icon} />
                                            </svg>
                                            <span class="truncate">{child.label}</span>
                                        </Link>
                                    </li>
                                    )}
                                </For>
                            </ul>
                        </Show>

                        {/* Arrow indicator */}
                        <div class="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-1.5 w-3 h-3 bg-surface/95 border-l border-b border-border/80 rotate-45" />
                    </div>
                </Portal>
            </Show>
        </li>
    );
};