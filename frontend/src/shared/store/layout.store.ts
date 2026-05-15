import { createSignal, createRoot } from 'solid-js';

const { isOpen, setOpen } = createRoot(() => {
    const [isMobileSidebarOpen, setMobileSidebarOpen] = createSignal(false);
    return { isOpen: isMobileSidebarOpen, setOpen: setMobileSidebarOpen };
});

export const useMobileSidebar = () => ({
    isOpen,
    open: () => setOpen(true),
    close: () => setOpen(false),
    toggle: () => setOpen(v => !v),
});
