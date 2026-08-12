import { Component, createSignal, onCleanup, Show } from 'solid-js';
import { Portal } from 'solid-js/web';
import { useSearchPalette } from '@shared/store/layout.store';
import { useSidebar } from './SidebarContext';
import { SearchIcon } from '@shared/ui/icons';

export const SidebarSearch: Component = () => {
    const { collapsed, activeTooltipId, setActiveTooltipId } = useSidebar();
    const { open: openSearch } = useSearchPalette();

    // --- TOOLTIP LOGIC (when collapsed) ---
    const [tooltipRect, setTooltipRect] = createSignal<{ top: number, left: number } | null>(null);
    let triggerRef: HTMLButtonElement | undefined;
    let tooltipRef: HTMLDivElement | undefined;
    let hoverTimeout: ReturnType<typeof setTimeout>;

    const handleMouseEnter = () => {
        if (!collapsed()) return;
        clearTimeout(hoverTimeout);
        if (triggerRef) {
            const rect = triggerRef.getBoundingClientRect();
            setTooltipRect({ top: rect.top + rect.height / 2, left: rect.right + 12 });
        }
        setActiveTooltipId('search');
    };

    const handleMouseLeave = () => {
        if (!collapsed()) return;
        hoverTimeout = setTimeout(() => {
            if (activeTooltipId() === 'search') setActiveTooltipId(null);
        }, 150);
    };

    onCleanup(() => {
        clearTimeout(hoverTimeout);
    });

    const shouldShowTooltip = () => collapsed() && activeTooltipId() === 'search' && tooltipRect();

    return (
        <div class="px-3 pt-3 pb-1.5 shrink-0">
            {/* TRIGGER: Botón estético adaptable con animación suave idéntica al menú */}
            <button
                ref={(el) => { triggerRef = el; }}
                onClick={openSearch}
                onMouseEnter={handleMouseEnter}
                onMouseLeave={handleMouseLeave}
                class="group w-full flex items-center gap-3 h-9.5 px-4 rounded-xl text-muted ease-[cubic-bezier(0.2,0,0,1)] cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-1 focus-visible:ring-offset-bg"
                classList={{
                    'border border-border/80 bg-card-alt/40 hover:border-primary-strong hover:bg-card-alt/80': !collapsed(),
                    'bg-transparent border border-transparent hover:bg-primary/8 hover:text-heading': collapsed()
                }}
                aria-label="Buscar módulo"
            >
                {/* Icon Container */}
                <div class="flex items-center justify-center size-5 shrink-0">
                    <SearchIcon class="size-4.5 group-hover:text-heading transition-colors" />
                </div>

                {/* Text & Shortcut Container */}
                <div
                    class="flex-1 flex items-center justify-between overflow-hidden transition-[opacity,max-width] duration-300 ease-[cubic-bezier(0.2,0,0,1)]"
                    classList={{
                        'opacity-100 max-w-[200px]': !collapsed(),
                        'opacity-0 max-w-0': collapsed()
                    }}
                >
                    <span class="text-sm font-medium whitespace-nowrap">Buscar...</span>
                    <kbd class="hidden sm:inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[10px] font-sans font-medium 
                               text-muted bg-surface border border-border/80 rounded-md shadow-xs select-none">
                        <span>Ctrl + </span>
                        <span>K</span>
                    </kbd>
                </div>
            </button>

            {/* Tooltip Portal (collapsed mode) */}
            <Show when={shouldShowTooltip()}>
                <Portal>
                    <div
                        ref={tooltipRef}
                        class="fixed z-[9999] p-2.5 bg-surface backdrop-blur-lg border border-border/80 rounded-xl shadow-2xl
                               animate-in fade-in slide-in-from-left-2 duration-150 flex items-center gap-3"
                        style={{ top: `${tooltipRect()?.top}px`, left: `${tooltipRect()?.left}px`, transform: 'translateY(-50%)' }}
                        onMouseEnter={() => clearTimeout(hoverTimeout)}
                        onMouseLeave={handleMouseLeave}
                    >
                        <span class="text-sm font-semibold text-heading">Buscar</span>
                        <kbd class="inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[10px] font-sans font-medium 
                                   text-muted bg-card border border-border/80 rounded-md shadow-xs select-none">
                            <span>Ctrl + </span>
                            <span>K</span>
                        </kbd>

                        {/* Arrow indicator */}
                        <div class="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-1.5 w-3 h-3 bg-surface border-l border-b border-border/80 rotate-45" />
                    </div>
                </Portal>
            </Show>
        </div>
    );
};
