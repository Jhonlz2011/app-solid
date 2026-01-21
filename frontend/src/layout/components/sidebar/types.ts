// Sidebar Types
export interface MenuItem {
    id: string;
    label: string;
    icon: string;
    path?: string;
    children?: MenuItem[];
}

export interface SidebarContextValue {
    collapsed: () => boolean;
    isMobileOpen: () => boolean;
    isMobileViewport: () => boolean;
    expandedMenus: () => Set<string>;
    activeTooltipId: () => string | null;
    optimisticPath: () => string | null;
    toggleCollapse: () => void;
    toggleMenu: (id: string) => void;
    setIsMobileOpen: (open: boolean) => void;
    setActiveTooltipId: (id: string | null) => void;
    handleNavigation: (path?: string) => void;
    isActive: (path?: string) => boolean;
    isItemActive: (item: MenuItem) => boolean;
    hasActiveDescendant: (item: MenuItem) => boolean;
}
