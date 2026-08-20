import { Component, createSignal, createMemo, createEffect, onCleanup, For, Show } from 'solid-js';
import { Portal } from 'solid-js/web';
import { useNavigate } from '@tanstack/solid-router';
import { useModules, ModuleConfig } from '@shared/store/modules.store';
import { useSearchPalette, useMobileSidebar } from '@shared/store/layout.store';
import { SearchIcon } from '@icons/SearchIcon';
import { SearchXIcon } from '@icons/SearchXIcon';
import { LockIcon } from '@icons/LockIcon';

interface SearchableItem {
    id: string;
    label: string;
    icon: string;
    path: string;
    status: string;
    breadcrumbs: string[];
}

export const GlobalSearchPalette: Component = () => {
    const navigate = useNavigate();
    const { isOpen: isMobileOpen, close: closeMobile } = useMobileSidebar();
    const { isOpen: isSearchOpen, open: openSearch, close: closeSearch } = useSearchPalette();
    const { modules } = useModules();

    const [searchQuery, setSearchQuery] = createSignal('');
    const [selectedIndex, setSelectedIndex] = createSignal(0);

    let searchInputRef: HTMLInputElement | undefined;
    let listContainerRef: HTMLDivElement | undefined;

    // 1. APLANAR ÁRBOL DE NAVEGACIÓN PARA BÚSQUEDA FUZZY/TEXTUAL
    const searchableItems = createMemo<SearchableItem[]>(() => {
        const flatten = (items: ModuleConfig[], parentBreadcrumbs: string[] = []): SearchableItem[] => {
            if (!Array.isArray(items)) return [];
            let flat: SearchableItem[] = [];
            for (const item of items) {
                const breadcrumbs = [...parentBreadcrumbs, item.label];
                if (item.path) {
                    flat.push({
                        id: item.key,
                        label: item.label,
                        icon: item.icon || '',
                        path: item.path,
                        status: item.status || 'active',
                        breadcrumbs
                    });
                }
                if (item.children?.length) {
                    flat.push(...flatten(item.children, breadcrumbs));
                }
            }
            return flat;
        };
        const raw = modules();
        return Array.isArray(raw) ? flatten(raw) : [];
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
            const item = items[selectedIndex()];
            if (item && item.status !== 'development') {
                handleSelectItem(item);
            }
        }
    };

    const handleSelectItem = (item: SearchableItem) => {
        if (item.status === 'development') return;
        navigate({ to: item.path });
        closeSearch();
        if (isMobileOpen()) {
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
        <Show when={isSearchOpen()}>
            <Portal>
                <div 
                    class="fixed inset-0 z-999 flex items-start justify-center p-4 pt-[10vh] overflow-y-auto"
                    onKeyDown={handlePaletteKeyDown}
                >
                    {/* Backdrop de desenfoque */}
                    <div 
                        class="fixed inset-0 bg-black/60 backdrop-blur-xs transition-opacity animate-in fade-in duration-200"
                        onClick={closeSearch}
                    />

                    {/* Caja del diálogo */}
                    <div 
                        class="relative w-full max-w-lg bg-surface/90 border border-border/80 shadow-2xl backdrop-blur-2xl rounded-2xl overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-200"
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
                                                    data-active={isActive() ? 'true' : undefined}
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
                                                                'bg-primary/20 text-primary-strong': isActive() && item.status !== 'development',
                                                                'bg-card text-muted group-hover:bg-card-alt': !isActive() || item.status === 'development'
                                                            }}
                                                        >
                                                            <svg class="size-4.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d={item.icon} />
                                                            </svg>
                                                        </div>

                                                        {/* Detalles del texto */}
                                                        <div class="flex flex-col min-w-0">
                                                            <span class="text-sm font-semibold truncate group-data-[active=true]:text-primary-strong text-heading"
                                                                classList={{
                                                                    'opacity-50 line-through decoration-muted': item.status === 'development'
                                                                }}
                                                            >
                                                                {item.label}
                                                            </span>
                                                            {/* Migas de pan de navegación */}
                                                            <span class="text-[11px] truncate text-muted mt-0.5">
                                                                {item.breadcrumbs.slice(0, -1).join(' > ')}
                                                            </span>
                                                        </div>
                                                    </div>

                                                    <div class="flex items-center gap-2">
                                                        {/* Icono de Candado si está en desarrollo */}
                                                        <Show when={item.status === 'development'}>
                                                            <div class="flex items-center justify-center size-5 bg-card/50 rounded border border-border/50 shrink-0">
                                                                <LockIcon class="size-3 text-muted/60" />
                                                            </div>
                                                        </Show>

                                                        {/* Indicador de acción (Enter) */}
                                                        <Show when={isActive() && item.status !== 'development'}>
                                                            <span class="text-[10px] font-sans font-semibold text-primary/70 bg-primary/20 border border-primary/30 rounded-md px-1.5 py-0.5">
                                                                Enter ↵
                                                            </span>
                                                        </Show>
                                                    </div>
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
    );
};
