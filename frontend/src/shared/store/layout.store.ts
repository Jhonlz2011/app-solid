import { createSignal, createRoot } from 'solid-js';

const { isMobileOpen, setMobileOpen, isSearchOpen, setSearchOpen } = createRoot(() => {
    const [isMobileSidebarOpen, setMobileSidebarOpen] = createSignal(false);
    const [isSearchPaletteOpen, setSearchPaletteOpen] = createSignal(false);
    return { 
        isMobileOpen: isMobileSidebarOpen, 
        setMobileOpen: setMobileSidebarOpen,
        isSearchOpen: isSearchPaletteOpen,
        setSearchOpen: setSearchPaletteOpen
    };
});

export const useMobileSidebar = () => ({
    isOpen: isMobileOpen,
    open: () => setMobileOpen(true),
    close: () => setMobileOpen(false),
    toggle: () => setMobileOpen(v => !v),
});

export const useSearchPalette = () => ({
    isOpen: isSearchOpen,
    open: () => setSearchOpen(true),
    close: () => setSearchOpen(false),
    toggle: () => setSearchOpen(v => !v),
});
