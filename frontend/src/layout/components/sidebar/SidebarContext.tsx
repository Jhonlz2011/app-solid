import { createContext, useContext, Accessor, ParentComponent } from 'solid-js';
import { MenuItem } from './types';

interface SidebarState {
    collapsed: Accessor<boolean>;
    isMobileOpen: Accessor<boolean>;
    isMobileViewport: Accessor<boolean>;
    expandedMenus: Accessor<Set<string>>;
    activeTooltipId: Accessor<string | null>;
    optimisticPath: Accessor<string | null>;
    // Actions
    setCollapsed: (v: boolean) => void;
    setIsMobileOpen: (v: boolean) => void;
    toggleMenu: (id: string) => void;
    setActiveTooltipId: (id: string | null) => void;
    handleNavigation: (path?: string) => void;
    // Helpers
    isActive: (path?: string) => boolean;
    isItemActive: (item: MenuItem) => boolean;
    hasActiveDescendant: (item: MenuItem) => boolean;
}

const SidebarContext = createContext<SidebarState>();

export const SidebarProvider: ParentComponent<{ value: SidebarState }> = (props) => {
    return (
        <SidebarContext.Provider value={props.value}>
            {props.children}
        </SidebarContext.Provider>
    );
};

export const useSidebar = () => {
    const context = useContext(SidebarContext);
    if (!context) throw new Error('useSidebar must be used within a SidebarProvider');
    return context;
};