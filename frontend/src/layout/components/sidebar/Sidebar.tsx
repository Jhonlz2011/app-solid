import { Component, createSignal, Show, createEffect, createMemo } from 'solid-js';
import { useNavigate, useLocation } from '@tanstack/solid-router';
import { useAuth } from '@modules/auth/store/auth.store';
import { useModules } from '@shared/store/modules.store';
import { SidebarHeader } from './SidebarHeader';
import { SidebarNav } from './SidebarNav';
import { SidebarFooter } from './SidebarFooter';
import { SidebarProvider } from './SidebarContext';
import { useMediaQuery } from '@shared/hooks/useMediaQuery';
import { useMobileSidebar } from '@shared/store/layout.store';
import type { MenuItem } from './types';

export const Sidebar: Component = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const auth = useAuth();
    const { modules } = useModules();

    const { isOpen: isMobileOpen, close: closeMobile } = useMobileSidebar();
    const [expandedMenus, setExpandedMenus] = createSignal<Set<string>>(new Set());
    const [activeTooltipId, setActiveTooltipId] = createSignal<string | null>(null);
    const [optimisticPath, setOptimisticPath] = createSignal<string | null>(null);

    // --- RESPONSIVENESS ---
    // Must match Tailwind sm: breakpoint (min-width: 640px) — use 639.9px to avoid overlap
    const isMobileViewport = useMediaQuery('(max-width: 639.9px)');

    // --- COLLAPSE LOGIC ---
    const [isCollapsed, setIsCollapsed] = createSignal(
        typeof window !== 'undefined' ? localStorage.getItem('sidebar-collapsed') === 'true' : false
    );

    const effectiveCollapsed = createMemo(() => !isMobileViewport() && isCollapsed());

    const toggleCollapse = () => {
        const next = !isCollapsed();
        setIsCollapsed(next);
        localStorage.setItem('sidebar-collapsed', String(next));
        if (next) setExpandedMenus(() => new Set<string>());
    };

    // When transitioning from desktop to mobile, close mobile sidebar and reset menus
    createEffect(() => {
        if (isMobileViewport()) {
            closeMobile();
            setActiveTooltipId(null);
        }
    });

    // --- NAVIGATION LOGIC ---
    const menuItems = createMemo(() => {
        const mapItem = (m: any): MenuItem => ({
            id: m.key,
            label: m.label,
            icon: m.icon || '',
            path: m.path,
            children: m.children?.map(mapItem)
        });
        return modules().map(mapItem);
    });

    const isActive = (path?: string) => {
        if (!path) return false;
        const current = optimisticPath() || location().pathname;
        return current === path || current.startsWith(path + '/');
    };

    const isItemActive = (item: MenuItem): boolean =>
        isActive(item.path) || (item.children?.some(isItemActive) ?? false);

    const hasActiveDescendant = (item: MenuItem): boolean =>
        item.children?.some(isItemActive) ?? false;

    const handleNavigation = (path?: string) => {
        if (path) {
            setOptimisticPath(path);
            navigate({ to: path });
            if (isMobileViewport()) closeMobile();
        }
    };

    // Reset optimistic path
    createEffect(() => {
        if (location().pathname === optimisticPath()) setOptimisticPath(null);
    });

    // --- CONTEXT VALUE ---
    const sidebarContext = {
        collapsed: effectiveCollapsed,
        isMobileOpen,
        isMobileViewport,
        expandedMenus,
        activeTooltipId,
        optimisticPath,
        setCollapsed: setIsCollapsed,
        setIsMobileOpen: closeMobile,
        toggleMenu: (id: string) => {
            setExpandedMenus(prev => {
                const next = new Set(prev);
                next.has(id) ? next.delete(id) : next.add(id);
                return next;
            });
        },
        setActiveTooltipId,
        handleNavigation,
        isActive,
        isItemActive,
        hasActiveDescendant
    };

    return (
        <SidebarProvider value={sidebarContext}>
            {/* Mobile Overlay */}
            <Show when={isMobileOpen()}>
                <div
                    class="fixed inset-0 bg-black/50 z-40 sm:hidden backdrop-blur-sm animate-in fade-in duration-200"
                    onClick={() => closeMobile()}
                    onKeyDown={(e) => e.key === 'Escape' && closeMobile()}
                    role="button"
                    tabIndex={0}
                    aria-label="Cerrar menú"
                />
            </Show>

            {/* Main Sidebar */}
            <aside
                data-collapsed={effectiveCollapsed()}
                data-mobile={isMobileOpen()}
                class="fixed top-0 left-0 h-screen z-50 w-64 flex flex-col bg-surface border-r border-border
                       transition-[width,transform] duration-300 ease-[cubic-bezier(0.2,0,0,1)]
                       sm:static sm:z-auto
                       max-sm:pt-[env(safe-area-inset-top)] 
                       data-[mobile=false]:-translate-x-full sm:data-[mobile=false]:translate-x-0
                       data-[mobile=true]:translate-x-0
                       data-[collapsed=true]:sm:w-20"
            >
                <SidebarHeader toggleCollapse={toggleCollapse} />

                <SidebarNav items={menuItems} />

                <SidebarFooter
                    userName={auth.user()?.username || 'Usuario'}
                    userRole={auth.user()?.roles?.[0] || 'Usuario'}
                />
            </aside>
        </SidebarProvider>
    );
};