import { Component, createSignal, Show, For, createEffect, onCleanup, Accessor, on, createMemo, Index } from 'solid-js';
import { Portal } from 'solid-js/web';
import { Link, useLocation } from '@tanstack/solid-router';

export interface MenuItem {
    id: string;
    label: string;
    icon: string;
    path?: string;
    children?: MenuItem[];
}

interface SidebarItemProps {
    item: MenuItem;
    level?: number;
    activeTooltipId: Accessor<string | null>;
    setActiveTooltipId: (id: string | null) => void;
    collapsed: Accessor<boolean>;
    expanded: Accessor<boolean>;
    toggleMenu: (id: string) => void;
    handleNavigation: (path?: string) => void;
    isMobileViewport: Accessor<boolean>;
    setIsMobileOpen: (open: boolean) => void;
    setExpandedMenus: (setter: (prev: Set<string>) => Set<string>) => void;
    isActive: (path?: string) => boolean;
    isItemActive: (item: MenuItem) => boolean;
    hasActiveDescendant: (item: MenuItem) => boolean;
}

export const SidebarItem: Component<SidebarItemProps> = (props) => {
    // Reactive accessors - DO NOT destructure props in SolidJS!
    const level = () => props.level ?? 0;
    const hasChildren = () => props.item.children && props.item.children.length > 0;
    const active = () => props.isItemActive(props.item);

    // Use createMemo to track the title computation within the reactive scope
    const title = createMemo(() => props.collapsed() ? props.item.label : undefined);

    const [tooltipPosition, setTooltipPosition] = createSignal<{ top: number; left: number } | null>(null);
    const [showTooltip, setShowTooltip] = createSignal(false);
    const [focusFirstChildOnOpen, setFocusFirstChildOnOpen] = createSignal(false);
    let buttonElement: HTMLButtonElement | HTMLAnchorElement | undefined;
    let hideTooltipTimeout: ReturnType<typeof setTimeout> | undefined;
    let showTooltipTimeout: ReturnType<typeof setTimeout> | undefined;
    let focusTimeout: ReturnType<typeof setTimeout> | undefined;
    const hideDelay = 280;
    const showDelay = 100;

    // IDs únicos para accesibilidad
    const buttonId = () => `sidebar-menu-${props.item.id}`;
    const submenuId = () => hasChildren() ? `sidebar-submenu-${props.item.id}` : undefined;
    const tooltipId = () => `sidebar-tooltip-${props.item.id}`;

    const location = useLocation();

    // Auto-expand if has active child (react to route changes) - solo si no está colapsado
    createEffect(on(() => location().pathname, () => {
        if (!props.collapsed() && hasChildren() && props.hasActiveDescendant(props.item) && !props.expanded()) {
            props.setExpandedMenus(prev => new Set(prev).add(props.item.id));
        }
    }));

    // Calcular posición del tooltip cuando está colapsado
    const updateTooltipPosition = () => {
        if (buttonElement && props.collapsed()) {
            const rect = buttonElement.getBoundingClientRect();
            setTooltipPosition({
                top: rect.top + rect.height / 2,
                left: rect.right + 8,
            });
        }
    };

    const clearHideTooltip = () => {
        if (hideTooltipTimeout) {
            clearTimeout(hideTooltipTimeout);
            hideTooltipTimeout = undefined;
        }
    };

    const clearShowTooltip = () => {
        if (showTooltipTimeout) {
            clearTimeout(showTooltipTimeout);
            showTooltipTimeout = undefined;
        }
    };

    const scheduleHideTooltip = () => {
        clearHideTooltip();
        hideTooltipTimeout = setTimeout(() => {
            setShowTooltip(false);
            if (props.activeTooltipId() === props.item.id) props.setActiveTooltipId(null);
        }, hideDelay);
    };

    const scheduleShowTooltip = () => {
        clearShowTooltip();
        showTooltipTimeout = setTimeout(() => {
            if (!props.collapsed()) return;
            updateTooltipPosition();
            setShowTooltip(true);
        }, showDelay);
    };

    const handleMouseEnter = () => {
        if (!props.collapsed()) return;
        clearHideTooltip();
        props.setActiveTooltipId(props.item.id);
        scheduleShowTooltip();
    };

    const handleMouseLeave = () => {
        if (props.collapsed()) scheduleHideTooltip();
    };

    // Manejar focus/blur para accesibilidad con teclado
    const handleFocus = () => {
        if (!props.collapsed()) return;
        clearHideTooltip();
        props.setActiveTooltipId(props.item.id);
        updateTooltipPosition();
        setShowTooltip(true);
    };

    const handleBlur = (e: FocusEvent) => {
        if (props.collapsed()) {
            // Pequeño delay para permitir focus en elementos del tooltip
            setTimeout(() => {
                if (document.activeElement?.closest(`#${tooltipId()}`) === null) {
                    scheduleHideTooltip();
                }
            }, 50);
        } else if (!props.collapsed() && hasChildren()) {
            // Si no está colapsado y tiene hijos, verificar si el focus se movió fuera del grupo
            const relatedTarget = e.relatedTarget as HTMLElement;
            const submenu = document.getElementById(submenuId()!);
            if (submenu && !submenu.contains(relatedTarget)) {
                // El focus salió del grupo de submenús
            }
        }
    };

    // Manejar navegación por teclado
    const handleKeyDown = (e: KeyboardEvent) => {
        // Solo procesar si el sidebar NO está colapsado
        if (!props.collapsed()) {
            // Deshabilitar flechas en modo expandido - solo usar Tab
            // Solo permitir Enter/Space para interacción
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                if (hasChildren()) {
                    props.toggleMenu(props.item.id);
                } else if (props.item.path) {
                    props.handleNavigation(props.item.path);
                }
                return;
            }

            // Escape para cerrar submenús
            if (e.key === 'Escape' && props.expanded() && hasChildren()) {
                e.preventDefault();
                props.toggleMenu(props.item.id);
                buttonElement?.focus();
                return;
            }
        }

        // En modo colapsado con menú de hijos
        if (props.collapsed() && hasChildren()) {
            // Flecha derecha: abrir tooltip y enfocar primer hijo
            if (e.key === 'ArrowRight') {
                e.preventDefault();

                // Si el tooltip ya está abierto, enfocar directamente el primer hijo
                if (showTooltip()) {
                    if (focusTimeout) clearTimeout(focusTimeout);
                    focusTimeout = setTimeout(() => {
                        const tooltip = document.getElementById(tooltipId());
                        const firstButton = tooltip?.querySelector('button[role="menuitem"]') as HTMLElement;
                        firstButton?.focus();
                        focusTimeout = undefined;
                    }, 50);
                } else {
                    // Si no está abierto, abrirlo y marcar para auto-focus
                    clearHideTooltip();
                    props.setActiveTooltipId(props.item.id);
                    updateTooltipPosition();
                    setFocusFirstChildOnOpen(true);
                    setShowTooltip(true);
                }
                return;
            }

            // Enter o Space: mostrar tooltip sin auto-focus
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                if (!showTooltip()) {
                    clearHideTooltip();
                    props.setActiveTooltipId(props.item.id);
                    updateTooltipPosition();
                    setFocusFirstChildOnOpen(false);
                    setShowTooltip(true);
                }
                return;
            }
        }

        // En modo colapsado sin hijos: Enter/Space navega
        if (props.collapsed() && !hasChildren()) {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                if (props.item.path) {
                    props.handleNavigation(props.item.path);
                }
                return;
            }
        }

        // Escape: cerrar submenú expandido y volver al padre
        if (e.key === 'Escape') {
            if (props.collapsed() && showTooltip()) {
                e.preventDefault();
                setShowTooltip(false);
                buttonElement?.focus();
            } else if (props.expanded() && hasChildren()) {
                e.preventDefault();
                props.toggleMenu(props.item.id);
                buttonElement?.focus();
            } else if (level() > 0) {
                // Si es un hijo, volver al padre
                e.preventDefault();
                const parentButton = buttonElement?.closest('[role="group"]')?.previousElementSibling;
                if (parentButton instanceof HTMLElement) {
                    parentButton.focus();
                }
            }
        }
    };

    // Cerrar tooltip cuando el sidebar se expande o cuando otro tooltip se activa
    createEffect(() => {
        const shouldClose = !props.collapsed() || (showTooltip() && props.activeTooltipId() !== props.item.id);
        if (shouldClose) {
            clearHideTooltip();
            clearShowTooltip();
            setShowTooltip(false);
            if (!props.collapsed() && props.activeTooltipId() === props.item.id) {
                props.setActiveTooltipId(null);
            }
        }
    });

    // Enfocar automáticamente el primer submenú cuando se abre el tooltip en modo colapsado
    createEffect(() => {
        if (props.collapsed() && hasChildren() && showTooltip() && focusFirstChildOnOpen()) {
            if (focusTimeout) clearTimeout(focusTimeout);
            focusTimeout = setTimeout(() => {
                const tooltip = document.getElementById(tooltipId());
                const firstButton = tooltip?.querySelector('button[role="menuitem"]') as HTMLElement;
                firstButton?.focus();
                setFocusFirstChildOnOpen(false);
                focusTimeout = undefined;
            }, 100);
        }
    });

    // Resetear flag cuando se cierra el tooltip
    createEffect(() => {
        if (!showTooltip()) {
            setFocusFirstChildOnOpen(false);
        }
    });

    const shouldShowTooltip = () => props.collapsed() && showTooltip() && props.activeTooltipId() === props.item.id;

    // Actualizar posición del tooltip cuando cambie el scroll o el estado colapsado
    createEffect(() => {
        if (shouldShowTooltip() && buttonElement) {
            const handleScroll = () => updateTooltipPosition();
            const handleResize = () => updateTooltipPosition();

            window.addEventListener('scroll', handleScroll, true);
            window.addEventListener('resize', handleResize);

            // Note: simpleBarScrollElement logic needs to be handled via props or context if needed, 
            // but for now we rely on window scroll/resize which covers most cases or we can pass a ref.
            // For strict parity, we might need to pass the scroll element ref from parent.

            return () => {
                window.removeEventListener('scroll', handleScroll, true);
                window.removeEventListener('resize', handleResize);
            };
        }
    });

    onCleanup(() => {
        clearHideTooltip();
        clearShowTooltip();
        if (focusTimeout) {
            clearTimeout(focusTimeout);
            focusTimeout = undefined;
        }
    });

    // Simplified classes using new CSS utility classes
    const getItemClasses = createMemo(() => {
        const classes: string[] = ['sidebar-item'];

        // Child item style
        if (level() > 0 && !props.collapsed()) {
            classes.push('sidebar-item--child');
        }

        // Active state (direct match or parent in collapsed mode with active descendant)
        const isDirectlyActive = !hasChildren() && active();
        const isParentActiveCollapsed = hasChildren() && props.collapsed() && props.hasActiveDescendant(props.item);

        if (isDirectlyActive || isParentActiveCollapsed) {
            classes.push('sidebar-item--active');
        } else if (hasChildren() && !props.collapsed() && props.hasActiveDescendant(props.item)) {
            // Parent with active child (not collapsed)
            classes.push('sidebar-item--parent-active');
        }

        return classes.join(' ');
    });

    const content = (
        <>
            {/* Icono - envuelto para mantener posición */}
            <div class="flex items-center justify-center w-5 h-5 flex-none relative">
                <Show when={level() > 0}>
                    {/* Dot indicator for children */}
                    <div class="sidebar-item-dot absolute left-[-12px]"></div>
                </Show>
                <svg class="sidebar-item-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d={props.item.icon} />
                </svg>
            </div>

            {/* Texto - desaparece con animación */}
            <div
                classList={{
                    'flex items-center justify-between overflow-hidden': true,
                    'flex-1 opacity-100 max-w-full': !props.collapsed(),
                    'flex-none opacity-0 max-w-0': props.collapsed()
                }}
                style={{ transition: 'opacity 0.3s ease, max-width 0.3s ease' }}
                aria-hidden={props.collapsed() ? 'true' : 'false'}
            >
                <span class="whitespace-nowrap">{props.item.label}</span>
                <Show when={hasChildren()}>
                    <svg
                        classList={{
                            'sidebar-item-chevron': true,
                            'sidebar-item-chevron--expanded': props.expanded()
                        }}
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                    >
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
                    </svg>
                </Show>
            </div>
        </>
    );

    return (
        <div class="relative group">
            <Show
                when={!hasChildren() && props.item.path}
                fallback={
                    <button
                        ref={el => buttonElement = el as HTMLButtonElement}
                        id={buttonId()}
                        onMouseEnter={handleMouseEnter}
                        onMouseLeave={handleMouseLeave}
                        onFocus={handleFocus}
                        onBlur={handleBlur}
                        onKeyDown={handleKeyDown}
                        onClick={() => {
                            if (hasChildren()) {
                                if (!props.collapsed()) {
                                    // Expanded mode: toggle submenu
                                    props.toggleMenu(props.item.id);
                                } else {
                                    // Collapsed mode: open tooltip menu
                                    clearHideTooltip();
                                    props.setActiveTooltipId(props.item.id);
                                    updateTooltipPosition();
                                    setShowTooltip(true);
                                }
                            }
                        }}
                        aria-expanded={hasChildren() ? (props.collapsed() ? showTooltip() : props.expanded()) : undefined}
                        aria-controls={hasChildren() ? (props.collapsed() ? tooltipId() : submenuId()) : undefined}
                        aria-haspopup={hasChildren() && props.collapsed() ? 'menu' : undefined}
                        aria-current={active() ? 'page' : undefined}
                        class={getItemClasses()}
                        aria-label={title()}
                    >
                        {content}
                    </button>
                }
            >
                <Link
                    to={props.item.path!}
                    ref={el => buttonElement = el as HTMLAnchorElement}
                    id={buttonId()}
                    onMouseEnter={handleMouseEnter}
                    onMouseLeave={handleMouseLeave}
                    onFocus={handleFocus}
                    onBlur={handleBlur}
                    onKeyDown={handleKeyDown}
                    onClick={() => {
                        if (props.isMobileViewport()) props.setIsMobileOpen(false);
                    }}
                    class={getItemClasses()}
                    aria-label={title()}
                >
                    {content}
                </Link>
            </Show>

            {/* Tooltip con Portal cuando está colapsado */}
            <Show when={shouldShowTooltip() && tooltipPosition()}>
                <Portal>
                    <div
                        id={tooltipId()}
                        role={hasChildren() ? 'menu' : 'tooltip'}
                        aria-label={`Menú de ${props.item.label}`}
                        tabIndex={-1}
                        class={`fixed px-3 py-2 surface-panel text-sm rounded-lg shadow-xl z-[9999] border border-surface ${hasChildren() ? 'min-w-[180px] pointer-events-auto' : 'whitespace-nowrap pointer-events-auto'}`}
                        style={{
                            top: `${tooltipPosition()!.top}px`,
                            left: `${tooltipPosition()!.left}px`,
                            transform: 'translateY(-50%)',
                        }}
                        onMouseEnter={() => {
                            updateTooltipPosition();
                            clearHideTooltip();
                            clearShowTooltip();
                            props.setActiveTooltipId(props.item.id);
                        }}
                        onMouseLeave={() => {
                            scheduleHideTooltip();
                        }}
                        onKeyDown={(e: KeyboardEvent) => {
                            // Escape: cerrar tooltip y volver al botón padre
                            if (e.key === 'Escape') {
                                e.preventDefault();
                                setShowTooltip(false);
                                buttonElement?.focus();
                            }
                            // Flecha izquierda: cerrar tooltip y volver al botón padre
                            if (e.key === 'ArrowLeft') {
                                e.preventDefault();
                                setShowTooltip(false);
                                buttonElement?.focus();
                            }
                        }}
                    >
                        <div class="font-medium text-sm" tabIndex={-1}>{props.item.label}</div>
                        {hasChildren() && props.item.children && (
                            <div class="sidebar-tooltip-menu" role="group" tabIndex={-1}>
                                <Index each={props.item.children}>
                                    {(child) => {
                                        // Use getter for reactivity
                                        const isActive = () => props.isItemActive(child());
                                        return (
                                            <button
                                                role="menuitem"
                                                tabIndex={0}
                                                classList={{
                                                    'sidebar-tooltip-item': true,
                                                    'sidebar-tooltip-item--active': isActive(),
                                                }}
                                                onClick={(event) => {
                                                    event.stopPropagation();
                                                    props.handleNavigation(child().path);
                                                    setShowTooltip(false);
                                                    buttonElement?.focus();
                                                }}
                                                onKeyDown={(e: KeyboardEvent) => {
                                                    const currentButton = e.currentTarget as HTMLElement;
                                                    const allButtons = Array.from(
                                                        currentButton.parentElement?.querySelectorAll('button[role="menuitem"]') || []
                                                    ) as HTMLElement[];
                                                    const currentIndex = allButtons.indexOf(currentButton);

                                                    if (e.key === 'ArrowDown') {
                                                        e.preventDefault();
                                                        const nextIndex = (currentIndex + 1) % allButtons.length;
                                                        allButtons[nextIndex]?.focus();
                                                    } else if (e.key === 'ArrowUp') {
                                                        e.preventDefault();
                                                        const prevIndex = currentIndex === 0 ? allButtons.length - 1 : currentIndex - 1;
                                                        allButtons[prevIndex]?.focus();
                                                    } else if (e.key === 'Enter' || e.key === ' ') {
                                                        e.preventDefault();
                                                        props.handleNavigation(child().path);
                                                        setShowTooltip(false);
                                                        buttonElement?.focus();
                                                    } else if (e.key === 'Escape' || e.key === 'ArrowLeft') {
                                                        e.preventDefault();
                                                        setShowTooltip(false);
                                                        buttonElement?.focus();
                                                    }
                                                }}
                                                aria-label={child().label}
                                            >
                                                <svg
                                                    classList={{
                                                        'w-4 h-4 transition-colors duration-150': true,
                                                        'text-muted group-hover:text-accent': !isActive(),
                                                        'text-primary-strong': isActive(),
                                                    }}
                                                    fill="none"
                                                    stroke="currentColor"
                                                    viewBox="0 0 24 24"
                                                >
                                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d={child().icon} />
                                                </svg>
                                                <span
                                                    classList={{
                                                        'flex-1 text-xs font-medium transition-colors duration-150': true,
                                                        'text-muted': !isActive(),
                                                        'text-primary-strong font-semibold': isActive(),
                                                    }}
                                                >
                                                    {child().label}
                                                </span>
                                                <Show when={isActive()}>
                                                    <div class="w-1.5 h-1.5 rounded-full bg-primary animate-pulse"></div>
                                                </Show>
                                            </button>
                                        );
                                    }}
                                </Index>
                            </div>
                        )}
                        {!hasChildren() && (
                            <div class="text-xs text-muted mt-1 whitespace-nowrap" tabIndex={-1}>
                                {props.item.path}
                            </div>
                        )}
                        <div class="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-1 w-2 h-2 bg-card border-l border-b border-surface rotate-45 pointer-events-none" tabIndex={-1}></div>
                    </div>
                </Portal>
            </Show>

            <Show when={hasChildren() && !props.collapsed()}>
                <div
                    class="sidebar-submenu-wrapper"
                    classList={{
                        'expanded': props.expanded()
                    }}
                >
                    <div
                        class="sidebar-submenu-inner"
                        id={submenuId()}
                        role="group"
                        aria-label={`Submenú de ${props.item.label}`}
                    >
                        <div class="sidebar-submenu space-y-0.5 mt-1">
                            <Index each={props.item.children}>
                                {(child) => (
                                    <SidebarItem
                                        item={child()}
                                        level={level() + 1}
                                        activeTooltipId={props.activeTooltipId}
                                        setActiveTooltipId={props.setActiveTooltipId}
                                        collapsed={props.collapsed}
                                        expanded={() => false} // Children don't expand recursively in this design
                                        toggleMenu={() => { }} // No sub-sub menus for now
                                        handleNavigation={props.handleNavigation}
                                        isMobileViewport={props.isMobileViewport}
                                        setIsMobileOpen={props.setIsMobileOpen}
                                        setExpandedMenus={props.setExpandedMenus}
                                        isActive={props.isActive}
                                        isItemActive={props.isItemActive}
                                        hasActiveDescendant={props.hasActiveDescendant}
                                    />
                                )}
                            </Index>
                        </div>
                    </div>
                </div>
            </Show>
        </div>
    );
};
