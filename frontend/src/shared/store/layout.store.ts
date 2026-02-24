import { createSignal } from 'solid-js';

const [isMobileSidebarOpen, setMobileSidebarOpen] = createSignal(false);

export const useMobileSidebar = () => ({
    isOpen: isMobileSidebarOpen,
    open: () => setMobileSidebarOpen(true),
    close: () => setMobileSidebarOpen(false),
    toggle: () => setMobileSidebarOpen(v => !v),
});
