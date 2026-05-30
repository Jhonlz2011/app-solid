import { Component, createSignal, createMemo, createEffect, onCleanup, For, Show } from 'solid-js';
import { Portal } from 'solid-js/web';
import { useNavigate } from '@tanstack/solid-router';
import { useModules, ModuleConfig } from '@shared/store/modules.store';
import { useSearchPalette, useMobileSidebar } from '@shared/store/layout.store';
import { useSidebar } from './SidebarContext';
import { SearchIcon, SearchXIcon } from '@shared/ui/icons';

interface SearchableItem {
    id: string;
    label: string;
    icon: string;
    path: string;
    breadcrumbs: string[];
}

export const SidebarSearch: Component = () => {
    const navigate = useNavigate();
    const { collapsed, isMobileViewport, activeTooltipId, setActiveTooltipId } = useSidebar();
    const { isOpen: isMobileOpen, close: closeMobile } = useMobileSidebar();
    const { isOpen: isSearchOpen, open: openSearch, close: closeSearch } = useSearchPalette();
    const { modules } = useModules();

    const [searchQuery, setSearchQuery] = createSignal('');
    const [selectedIndex, setSelectedIndex] = createSignal(0);

    let searchInputRef: HTMLInputElement | undefined;
    let listContainerRef: HTMLDivElement | undefined;

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

    // 1. APLANAR ÁRBOL DE NAVEGACIÓN PARA BÚSQUEDA FUZZY/TEXTUAL
    const searchableItems = createMemo<SearchableItem[]>(() => {
        const flatten = (items: ModuleConfig[], parentBreadcrumbs: string[] = []): SearchableItem[] => {
            let flat: SearchableItem[] = [];
            for (const item of items) {
                const breadcrumbs = [...parentBreadcrumbs, item.label];
                if (item.path) {
                    flat.push({
                        id: item.key,
                        label: item.label,
                        icon: item.icon || '',
                        path: item.path,
                        breadcrumbs
                    });
                }
                if (item.children?.length) {
                    flat.push(...flatten(item.children, breadcrumbs));
                }
            }
            return flat;
        };
        return flatten(modules());
    });

    // 2. FILTRAR RESULTADOS
    const filteredItems = createMemo(() => {
        const query = searchQuery().toLowerCase().trim();
        if (!query) return searchableItems();
        return searchableItems().filter(item => 
            item.label.toLowerCase().includes(query) ||
            item.breadcrumbs.some(b => b.toLowerCase().includes(query))
        );
    });

    // Asegurar que el index no quede desbordado al cambiar la consulta
    createEffect(() => {
        searchQuery();
        setSelectedIndex(0);
    });

    // 3. ENFOCAR AUTOMÁTICAMENTE EL INPUT AL ABRIR LA PALETA
    createEffect(() => {
        if (isSearchOpen() && searchInputRef) {
            setTimeout(() => searchInputRef?.focus(), 50);
        } else {
            setSearchQuery('');
        }
    });

    // 4. MANEJO GLOBAL DE ATAJOS (Ctrl + K / Cmd + K)
    createEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
                e.preventDefault();
                isSearchOpen() ? closeSearch() : openSearch();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        onCleanup(() => window.removeEventListener('keydown', handleKeyDown));
    });

    // 5. MANEJO DE TECLADO INTERNO EN PALETA
    const handlePaletteKeyDown = (e: KeyboardEvent) => {
        if (!isSearchOpen()) return;

        const items = filteredItems();
        if (e.key === 'Escape') {
            e.preventDefault();
            closeSearch();
        } else if (e.key === 'ArrowDown') {
            e.preventDefault();
            setSelectedIndex(prev => (items.length > 0 ? (prev + 1) % items.length : 0));
            scrollToActiveItem();
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setSelectedIndex(prev => (items.length > 0 ? (prev - 1 + items.length) % items.length : 0));
            scrollToActiveItem();
        } else if (e.key === 'Enter') {
            e.preventDefault();
            if (items[selectedIndex()]) {
                handleSelectItem(items[selectedIndex()]);
            }
        }
    };

    const handleSelectItem = (item: SearchableItem) => {
        navigate({ to: item.path });
        closeSearch();
        if (isMobileViewport() && isMobileOpen()) {
            closeMobile();
        }
    };

    const scrollToActiveItem = () => {
        const activeElement = listContainerRef?.querySelector('[data-active="true"]');
        if (activeElement) {
            activeElement.scrollIntoView({ block: 'nearest' });
        }
    };

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

            {/* PALETA DE COMANDOS (PORTAL) */}
            <Show when={isSearchOpen()}>
                <Portal>
                    <div 
                        class="fixed inset-0 z-[999] flex items-start justify-center p-4 pt-[10vh] overflow-y-auto"
                        onKeyDown={handlePaletteKeyDown}
                    >
                        {/* Backdrop de desenfoque */}
                        <div 
                            class="fixed inset-0 bg-black/60 backdrop-blur-xs transition-opacity animate-in fade-in duration-200"
                            onClick={closeSearch}
                        />

                        {/* Caja del diálogo */}
                        <div 
                            class="relative w-full max-w-lg bg-surface/90 border border-border/80 shadow-2xl backdrop-blur-2xl rounded-2xl overflow-hidden 
                                   flex flex-col animate-in fade-in zoom-in-95 duration-200"
                            onClick={(e) => e.stopPropagation()}
                            role="dialog"
                            aria-modal="true"
                        >
                            {/* Barra de búsqueda superior */}
                            <div class="flex items-center gap-3 px-4 py-3 border-b border-border/60">
                                <SearchIcon class="size-5 text-muted" />
                                <input
                                    ref={searchInputRef}
                                    type="text"
                                    placeholder="Buscar módulo..."
                                    value={searchQuery()}
                                    onInput={(e) => setSearchQuery(e.currentTarget.value)}
                                    class="flex-1 bg-transparent text-text border-none outline-none placeholder:text-muted/80 text-base focus-visible:shadow-none"
                                    aria-label="Buscar vista"
                                />
                                <kbd 
                                    class="px-1.5 py-0.5 text-[10px] font-semibold text-muted bg-card border border-border/60 rounded-md cursor-pointer hover:bg-card-alt select-none"
                                    onClick={closeSearch}
                                >
                                    ESC
                                </kbd>
                            </div>

                            {/* Contenido / Listado de resultados */}
                            <div 
                                ref={listContainerRef}
                                class="max-h-90 overflow-y-auto p-2 space-y-1 simplebar-container"
                            >
                                <Show 
                                    when={filteredItems().length > 0}
                                    fallback={
                                        /* ESTADO VACÍO (No Matches) */
                                        <div class="py-8 px-4 text-center">
                                            <div class="size-10 bg-danger/10 text-danger rounded-full flex items-center justify-center mx-auto mb-3">
                                                <SearchXIcon class="size-5" />
                                            </div>
                                            <p class="font-semibold text-sm text-heading">No se encontraron resultados</p>
                                            <p class="text-xs text-muted mt-1">
                                                No pudimos encontrar nada para "<span class="font-medium text-danger">{searchQuery()}</span>"
                                            </p>
                                        </div>
                                    }
                                >
                                    <ul role="listbox" aria-label="Resultados de búsqueda">
                                        <For each={filteredItems()}>
                                            {(item, index) => {
                                                const isActive = () => index() === selectedIndex();
                                                
                                                return (
                                                    <li
                                                        role="option"
                                                        aria-selected={isActive()}
                                                        onClick={() => handleSelectItem(item)}
                                                        onMouseEnter={() => setSelectedIndex(index())}
                                                        data-active={isActive()}
                                                        class="group flex items-center justify-between p-3 rounded-xl cursor-pointer transition-all duration-150"
                                                        classList={{
                                                            'bg-primary/10 text-primary-strong': isActive(),
                                                            'text-muted hover:bg-card-alt/40': !isActive()
                                                        }}
                                                    >
                                                        <div class="flex items-center gap-3 min-w-0">
                                                            {/* Icono del módulo con contenedor sutil */}
                                                            <div 
                                                                class="size-8 rounded-lg flex items-center justify-center shrink-0 transition-colors"
                                                                classList={{
                                                                    'bg-primary/20 text-primary-strong': isActive(),
                                                                    'bg-card  text-muted group-hover:bg-card-alt': !isActive()
                                                                }}
                                                            >
                                                                <svg class="size-4.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d={item.icon} />
                                                                </svg>
                                                            </div>

                                                            {/* Detalles del texto */}
                                                            <div class="flex flex-col min-w-0">
                                                                <span class="text-sm font-semibold truncate group-data-[active=true]:text-primary-strong text-heading">
                                                                    {item.label}
                                                                </span>
                                                                {/* Migas de pan de navegación */}
                                                                <span class="text-[11px] truncate text-muted mt-0.5">
                                                                    {item.breadcrumbs.slice(0, -1).join(' > ')}
                                                                </span>
                                                            </div>
                                                        </div>

                                                        {/* Indicador de acción (Enter) */}
                                                        <Show when={isActive()}>
                                                            <span class="text-[10px] font-sans font-semibold text-primary/70 bg-primary/20 border border-primary/30 rounded-md px-1.5 py-0.5">
                                                                Enter ↵
                                                            </span>
                                                        </Show>
                                                    </li>
                                                );
                                            }}
                                        </For>
                                    </ul>
                                </Show>
                            </div>
                        </div>
                    </div>
                </Portal>
            </Show>
        </div>
    );
};
