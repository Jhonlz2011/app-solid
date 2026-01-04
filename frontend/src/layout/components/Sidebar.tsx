import { Component, createSignal, Show, For, createEffect, onCleanup, Accessor, on, Index } from 'solid-js';
import { useNavigate, useLocation, Link } from '@tanstack/solid-router';
import { useAuth, actions as authActions } from '@modules/auth/auth.store';
import SimpleBar from 'simplebar';
import 'simplebar/dist/simplebar.css';
import ThemeToggle from './ThemeToggle';
import { useModules } from '../../shared/store/modules.store';
import { SidebarItem, MenuItem } from './SidebarItem';

type TimeoutId = ReturnType<typeof setTimeout>;

const Sidebar: Component = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const auth = useAuth();
  const [isLoggingOut, setIsLoggingOut] = createSignal(false);
  const [expandedMenus, setExpandedMenus] = createSignal<Set<string>>(new Set());
  const [isMobileOpen, setIsMobileOpen] = createSignal(false);
  const [activeTooltipId, setActiveTooltipId] = createSignal<string | null>(null);
  const [showUserMenu, setShowUserMenu] = createSignal(false);
  const [optimisticPath, setOptimisticPath] = createSignal<string | null>(null);
  let userMenuRef: HTMLDivElement | undefined;

  // Close user menu on click outside
  createEffect(() => {
    if (!showUserMenu()) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (userMenuRef && !userMenuRef.contains(e.target as Node)) {
        setShowUserMenu(false);
      }
    };
    window.addEventListener('mousedown', handleClickOutside);
    onCleanup(() => window.removeEventListener('mousedown', handleClickOutside));
  });

  const handleAccountClick = () => {
    navigate({ to: '/' });
    if (isMobileViewport()) {
      setIsMobileOpen(false);
    }
  };

  const userName = () => auth.user()?.username || 'Usuario';
  const userRole = () => auth.user()?.roles?.[0] || 'Usuario';

  const getInitialCollapsedState = () => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('sidebar-collapsed');
      return saved === 'true';
    }
    return false;
  };

  const [isCollapsed, setIsCollapsed] = createSignal(getInitialCollapsedState());
  const [viewportWidth, setViewportWidth] = createSignal(
    typeof window !== 'undefined' ? window.innerWidth : 1024
  );
  const isMobileViewport = () => viewportWidth() < 640;
  const effectiveCollapsed = () => !isMobileViewport() && isCollapsed();

  let scrollableElement: HTMLElement | undefined;
  let simpleBarInstance: SimpleBar | null = null;
  let simpleBarScrollElement: HTMLElement | null = null;
  let resizeObserver: ResizeObserver | null = null;
  let recalculateTimeout: TimeoutId | undefined;

  // Inicializar SimpleBar con ResizeObserver
  createEffect(() => {
    if (scrollableElement && typeof window !== 'undefined' && !simpleBarInstance) {
      simpleBarInstance = new SimpleBar(scrollableElement, {
        autoHide: true,
      });
      simpleBarScrollElement = simpleBarInstance.getScrollElement();

      // Remover tabindex del content-wrapper para evitar que reciba focus con Tab
      const contentWrapper = scrollableElement.querySelector('.simplebar-content-wrapper');
      if (contentWrapper) {
        contentWrapper.setAttribute('tabindex', '-1');
      }

      // Observar cambios de tamaño usando el scroll element directamente
      if ('ResizeObserver' in window && simpleBarScrollElement) {
        resizeObserver = new ResizeObserver(() => {
          simpleBarInstance?.recalculate();
        });
        // Observar el scroll element en lugar de .simplebar-content
        resizeObserver.observe(simpleBarScrollElement);
      }
    }
  });

  // Recalcular SimpleBar cuando cambie el estado (fallback para navegadores sin ResizeObserver)
  createEffect(() => {
    isCollapsed();
    expandedMenus();

    if (simpleBarInstance && !resizeObserver) {
      // Limpiar timeout anterior
      if (recalculateTimeout) {
        clearTimeout(recalculateTimeout);
      }
      recalculateTimeout = window
        .setTimeout(() => simpleBarInstance?.recalculate(), 250) as unknown as TimeoutId;
    }
  });


  // Cleanup cuando el componente se desmonte
  onCleanup(() => {
    // Limpiar timeout pendiente
    if (recalculateTimeout) {
      clearTimeout(recalculateTimeout);
      recalculateTimeout = undefined;
    }

    if (resizeObserver) {
      resizeObserver.disconnect();
      resizeObserver = null;
    }

    if (simpleBarInstance) {
      // Usar el método correcto según la versión
      if (typeof simpleBarInstance.unMount === 'function') {
        simpleBarInstance.unMount();
      }
      simpleBarInstance = null;
      simpleBarScrollElement = null;
    }
  });

  // Guardar estado en localStorage
  createEffect(() => {
    if (typeof window !== 'undefined') {
      // No guardamos en localStorage para que siempre inicie colapsado por defecto o según lógica
      // localStorage.setItem('sidebarCollapsed', JSON.stringify(isCollapsed()));
    }
  });

  const toggleCollapse = () => {
    const newState = !isCollapsed();
    setIsCollapsed(newState);
    // Cerrar todos los submenús cuando se colapsa
    if (newState) {
      setExpandedMenus(new Set<string>());
    }
  };

  // Listen for open sidebar event from mobile header and handle ESC key
  createEffect(() => {
    if (typeof window === 'undefined') return;

    const handleOpenSidebar = () => {
      setIsMobileOpen(true);
    };

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isMobileOpen()) {
        setIsMobileOpen(false);
      }
    };

    window.addEventListener('open-sidebar', handleOpenSidebar);
    window.addEventListener('keydown', handleEscape);

    return () => {
      window.removeEventListener('open-sidebar', handleOpenSidebar);
      window.removeEventListener('keydown', handleEscape);
    };
  });

  const { modules } = useModules();



  const menuItems = () => {
    // Map modules from context to MenuItem structure
    // Since config is already nested, we just need to map properties
    const mapModuleToMenuItem = (m: any): MenuItem => ({
      id: m.key,
      label: m.label,
      icon: m.icon || '',
      path: m.path,
      children: m.children?.map(mapModuleToMenuItem)
    });

    const dynamicItems = modules().map(mapModuleToMenuItem);

    // Dashboard is already in config, so we don't need to add it manually if it's there
    // But if we want to force it or if it's not in config, we can handle it.
    // Assuming config has everything including dashboard.
    return dynamicItems;
  };

  const toggleMenu = (menuId: string) => {
    setExpandedMenus((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(menuId)) {
        newSet.delete(menuId);
      } else {
        newSet.add(menuId);
      }
      return newSet;
    });
  };

  const isMenuExpanded = (menuId: string) => {
    return expandedMenus().has(menuId);
  };

  const isActive = (path?: string) => {
    if (!path) return false;
    // Use optimistic path if available for instant feedback, otherwise fallback to router location
    const currentPath = optimisticPath() || location().pathname;
    return currentPath === path || currentPath.startsWith(path + '/');
  };

  // Auto-expand parent menus if any child is active
  const isItemActive = (item: MenuItem): boolean => {
    if (isActive(item.path)) return true;
    return item.children?.some((child) => isItemActive(child)) ?? false;
  };

  const hasActiveDescendant = (item: MenuItem): boolean => {
    if (!item.children) return false;
    return item.children.some((child) => isItemActive(child));
  };

  const handleNavigation = (path?: string): void => {
    if (path) {
      setOptimisticPath(path); // Set optimistic path for instant feedback
      navigate({ to: path });
      // Close mobile menu after navigation
      if (isMobileViewport()) {
        setIsMobileOpen(false);
      }
    }
  };

  // Clear optimistic path when location actually updates
  createEffect(() => {
    if (location().pathname === optimisticPath()) {
      setOptimisticPath(null);
    }
  });

  // Close mobile menu when route changes
  createEffect(() => {
    // Track pathname to close menu on route change
    location().pathname;
    if (isMobileViewport()) {
      setIsMobileOpen(false);
    }
  });

  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      await authActions.logout();
      navigate({ to: '/login', search: { redirect: undefined } });
    } finally {
      setIsLoggingOut(false);
    }
  };

  // Actualizar viewport width en tiempo real (para detectar modo mobile)
  createEffect(() => {
    if (typeof window === 'undefined') return;
    const handleResize = () => setViewportWidth(window.innerWidth);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  });

  return (
    <>
      {/* Mobile Overlay */}
      <Show when={isMobileOpen()}>
        <div
          class="fixed inset-0 bg-black/50 z-40 sm:hidden animate-[fadeIn_0.3s_ease-in-out] backdrop-blur-sm"
          onClick={() => setIsMobileOpen(false)}
          role="button"
          aria-label="Cerrar menú lateral"
          tabIndex={0}
          onKeyDown={(e: KeyboardEvent) => {
            if (e.key === 'Escape' || e.key === 'Enter') {
              setIsMobileOpen(false);
            }
          }}
        />
      </Show>

      {/* Sidebar */}
      <aside
        role="complementary"
        aria-label={effectiveCollapsed() ? 'Navegación lateral colapsada' : 'Navegación lateral'}
        class="fixed top-0 left-0 h-screen sidebar-panel z-50 w-64 flex flex-col overflow-visible sm:static sm:z-auto"
        classList={{
          'translate-x-0': isMobileOpen(),
          '-translate-x-full': !isMobileOpen(),
          'sm:translate-x-0': true,
          'transition-transform duration-300 ease-in-out': true,
          'sm:transition-[width] sm:duration-300 sm:ease-in-out': true,
          // En mobile siempre w-64, en desktop depende del estado colapsado
          'sm:w-20': effectiveCollapsed(),
          'sm:w-64': !effectiveCollapsed()
        }}
      >
        {/* Logo/Header */}
        <div class="border-b border-surface p-[19.8px] h-[90px]" tabIndex={-1}>
          <div class="flex items-center justify-between h-full" tabIndex={-1}>
            {/* Logo + texto: ícono A fijo, texto animado */}
            <div class="flex items-center gap-3 min-w-0 relative" tabIndex={-1}>
              {/* En mobile siempre mostrar logo completo, en desktop depende del estado */}
              <Show when={!effectiveCollapsed()}>
                {/* Logo A - Visible cuando está expandido o en mobile */}
                <div class="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center shrink-0" tabIndex={-1}>
                  <span class="text-white font-bold text-lg">A</span>
                </div>
              </Show>

              <Show when={effectiveCollapsed()}>
                {/* Contenedor con logo A + botón cuando está colapsado (solo desktop) */}
                <div class="hidden sm:block relative w-10 h-10 shrink-0">
                  {/* Botón con ícono de sidebar (peer) - Se muestra en hover/focus */}
                  <button
                    onClick={toggleCollapse}
                    class="peer absolute inset-0 w-10 h-10 flex items-center justify-center text-muted hover:text-accent opacity-0 hover:opacity-100 focus-visible:opacity-100 transition-opacity duration-200 rounded-lg hover-surface focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-1 focus-visible:ring-offset-transparent z-10"
                    title="Expandir sidebar"
                    aria-label="Expandir sidebar"
                  >
                    {/* Ícono de panel lateral para expandir */}
                    <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20" preserveAspectRatio="xMidYMid meet">
                      <path d="M6.83496 3.99992C6.38353 4.00411 6.01421 4.0122 5.69824 4.03801C5.31232 4.06954 5.03904 4.12266 4.82227 4.20012L4.62207 4.28606C4.18264 4.50996 3.81498 4.85035 3.55859 5.26848L3.45605 5.45207C3.33013 5.69922 3.25006 6.01354 3.20801 6.52824C3.16533 7.05065 3.16504 7.71885 3.16504 8.66301V11.3271C3.16504 12.2712 3.16533 12.9394 3.20801 13.4618C3.25006 13.9766 3.33013 14.2909 3.45605 14.538L3.55859 14.7216C3.81498 15.1397 4.18266 15.4801 4.62207 15.704L4.82227 15.79C5.03904 15.8674 5.31234 15.9205 5.69824 15.9521C6.01398 15.9779 6.383 15.986 6.83398 15.9902L6.83496 3.99992ZM18.165 11.3271C18.165 12.2493 18.1653 12.9811 18.1172 13.5702C18.0745 14.0924 17.9916 14.5472 17.8125 14.9648L17.7295 15.1415C17.394 15.8 16.8834 16.3511 16.2568 16.7353L15.9814 16.8896C15.5157 17.1268 15.0069 17.2285 14.4102 17.2773C13.821 17.3254 13.0893 17.3251 12.167 17.3251H7.83301C6.91071 17.3251 6.17898 17.3254 5.58984 17.2773C5.06757 17.2346 4.61294 17.1508 4.19531 16.9716L4.01855 16.8896C3.36014 16.5541 2.80898 16.0434 2.4248 15.4169L2.27051 15.1415C2.03328 14.6758 1.93158 14.167 1.88281 13.5702C1.83468 12.9811 1.83496 12.2493 1.83496 11.3271V8.66301C1.83496 7.74072 1.83468 7.00898 1.88281 6.41985C1.93157 5.82309 2.03329 5.31432 2.27051 4.84856L2.4248 4.57317C2.80898 3.94666 3.36012 3.436 4.01855 3.10051L4.19531 3.0175C4.61285 2.83843 5.06771 2.75548 5.58984 2.71281C6.17898 2.66468 6.91071 2.66496 7.83301 2.66496H12.167C13.0893 2.66496 13.821 2.66468 14.4102 2.71281C15.0069 2.76157 15.5157 2.86329 15.9814 3.10051L16.2568 3.25481C16.8833 3.63898 17.394 4.19012 17.7295 4.84856L17.8125 5.02531C17.9916 5.44285 18.0745 5.89771 18.1172 6.41985C18.1653 7.00898 18.165 7.74072 18.165 8.66301V11.3271ZM8.16406 15.995H12.167C13.1112 15.995 13.7794 15.9947 14.3018 15.9521C14.8164 15.91 15.1308 15.8299 15.3779 15.704L15.5615 15.6015C15.9797 15.3451 16.32 14.9774 16.5439 14.538L16.6299 14.3378C16.7074 14.121 16.7605 13.8478 16.792 13.4618C16.8347 12.9394 16.835 12.2712 16.835 11.3271V8.66301C16.835 7.71885 16.8347 7.05065 16.792 6.52824C16.7605 6.14232 16.7073 5.86904 16.6299 5.65227L16.5439 5.45207C16.32 5.01264 15.9796 4.64498 15.5615 4.3886L15.3779 4.28606C15.1308 4.16013 14.8165 4.08006 14.3018 4.03801C13.7794 3.99533 13.1112 3.99504 12.167 3.99504H8.16406C8.16407 3.99667 8.16504 3.99829 8.16504 3.99992L8.16406 15.995Z" />
                    </svg>
                  </button>

                  {/* Logo de la app - Se oculta en hover/focus del peer button */}
                  <div class="absolute inset-0 w-10 h-10 bg-linear-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center peer-hover:opacity-0 peer-focus-visible:opacity-0 transition-opacity duration-200">
                    <span class="text-white font-bold text-lg">A</span>
                  </div>
                </div>

                {/* Logo A para mobile cuando está colapsado */}
                <div class="sm:hidden w-10 h-10 bg-linear-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center shrink-0" tabIndex={-1}>
                  <span class="text-white font-bold text-lg">A</span>
                </div>
              </Show>

              {/* Texto - Se anima al colapsar, pero siempre visible en mobile */}
              <div
                classList={{
                  'flex flex-col justify-center overflow-hidden transition-all duration-300': true,
                  'opacity-100 max-w-[160px]': !effectiveCollapsed(),
                  'opacity-0 max-w-0': effectiveCollapsed()
                }}
                aria-hidden={effectiveCollapsed() ? 'true' : 'false'}
              >
                <h2 class="title-primary font-bold text-lg whitespace-nowrap">App</h2>
                <p class="text-muted text-xs whitespace-nowrap">Dashboard</p>
              </div>
            </div>

            <div class="flex items-center gap-2" tabIndex={-1}>
              <ThemeToggle collapsed={effectiveCollapsed()} />
              {/* Botón para colapsar - Solo desktop expandido */}
              <Show when={!isCollapsed()}>
                <button
                  onClick={toggleCollapse}
                  class="hidden sm:flex items-center justify-center text-muted hover-surface p-2 rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-1 focus-visible:ring-offset-transparent"
                  title="Colapsar sidebar"
                  aria-label="Colapsar sidebar"
                >
                  {/* Ícono de panel lateral para colapsar */}
                  <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M6.83496 3.99992C6.38353 4.00411 6.01421 4.0122 5.69824 4.03801C5.31232 4.06954 5.03904 4.12266 4.82227 4.20012L4.62207 4.28606C4.18264 4.50996 3.81498 4.85035 3.55859 5.26848L3.45605 5.45207C3.33013 5.69922 3.25006 6.01354 3.20801 6.52824C3.16533 7.05065 3.16504 7.71885 3.16504 8.66301V11.3271C3.16504 12.2712 3.16533 12.9394 3.20801 13.4618C3.25006 13.9766 3.33013 14.2909 3.45605 14.538L3.55859 14.7216C3.81498 15.1397 4.18266 15.4801 4.62207 15.704L4.82227 15.79C5.03904 15.8674 5.31234 15.9205 5.69824 15.9521C6.01398 15.9779 6.383 15.986 6.83398 15.9902L6.83496 3.99992ZM18.165 11.3271C18.165 12.2493 18.1653 12.9811 18.1172 13.5702C18.0745 14.0924 17.9916 14.5472 17.8125 14.9648L17.7295 15.1415C17.394 15.8 16.8834 16.3511 16.2568 16.7353L15.9814 16.8896C15.5157 17.1268 15.0069 17.2285 14.4102 17.2773C13.821 17.3254 13.0893 17.3251 12.167 17.3251H7.83301C6.91071 17.3251 6.17898 17.3254 5.58984 17.2773C5.06757 17.2346 4.61294 17.1508 4.19531 16.9716L4.01855 16.8896C3.36014 16.5541 2.80898 16.0434 2.4248 15.4169L2.27051 15.1415C2.03328 14.6758 1.93158 14.167 1.88281 13.5702C1.83468 12.9811 1.83496 12.2493 1.83496 11.3271V8.66301C1.83496 7.74072 1.83468 7.00898 1.88281 6.41985C1.93157 5.82309 2.03329 5.31432 2.27051 4.84856L2.4248 4.57317C2.80898 3.94666 3.36012 3.436 4.01855 3.10051L4.19531 3.0175C4.61285 2.83843 5.06771 2.75548 5.58984 2.71281C6.17898 2.66468 6.91071 2.66496 7.83301 2.66496H12.167C13.0893 2.66496 13.821 2.66468 14.4102 2.71281C15.0069 2.76157 15.5157 2.86329 15.9814 3.10051L16.2568 3.25481C16.8833 3.63898 17.394 4.19012 17.7295 4.84856L17.8125 5.02531C17.9916 5.44285 18.0745 5.89771 18.1172 6.41985C18.1653 7.00898 18.165 7.74072 18.165 8.66301V11.3271ZM8.16406 15.995H12.167C13.1112 15.995 13.7794 15.9947 14.3018 15.9521C14.8164 15.91 15.1308 15.8299 15.3779 15.704L15.5615 15.6015C15.9797 15.3451 16.32 14.9774 16.5439 14.538L16.6299 14.3378C16.7074 14.121 16.7605 13.8478 16.792 13.4618C16.8347 12.9394 16.835 12.2712 16.835 11.3271V8.66301C16.835 7.71885 16.8347 7.05065 16.792 6.52824C16.7605 6.14232 16.7073 5.86904 16.6299 5.65227L16.5439 5.45207C16.32 5.01264 15.9796 4.64498 15.5615 4.3886L15.3779 4.28606C15.1308 4.16013 14.8165 4.08006 14.3018 4.03801C13.7794 3.99533 13.1112 3.99504 12.167 3.99504H8.16406C8.16407 3.99667 8.16504 3.99829 8.16504 3.99992L8.16406 15.995Z" />
                  </svg>
                </button>
              </Show>

              {/* Botón para cerrar - Solo mobile */}
              <button
                onClick={() => setIsMobileOpen(false)}
                class="sm:hidden text-muted hover-surface p-2 rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-1 focus-visible:ring-offset-transparent"
                aria-label="Cerrar menú"
              >
                <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav
          ref={(el) => (scrollableElement = el)}
          role="navigation"
          aria-label="Menú principal"
          class="sidebar-scroll flex-1 py-4 px-3 min-h-0"
        >
          <div class="space-y-1 px-0" role="list" tabIndex={-1}>
            <Index each={menuItems()}>
              {(item) => (
                <div role="listitem" tabIndex={-1}>
                  <SidebarItem
                    item={item()}
                    activeTooltipId={activeTooltipId}
                    setActiveTooltipId={setActiveTooltipId}
                    collapsed={effectiveCollapsed}
                    expanded={() => isMenuExpanded(item().id)}
                    toggleMenu={toggleMenu}
                    handleNavigation={handleNavigation}
                    isMobileViewport={isMobileViewport}
                    setIsMobileOpen={setIsMobileOpen}
                    setExpandedMenus={setExpandedMenus}
                    isActive={isActive}
                    isItemActive={isItemActive}
                    hasActiveDescendant={hasActiveDescendant}
                  />
                </div>
              )}
            </Index>
          </div>
        </nav>

        {/* User Section / Logout */}
        <div
          class="p-4 relative border-t border-surface"
          tabIndex={-1}
          ref={userMenuRef}
        >
          <div class="relative">
            <button
              onClick={() => setShowUserMenu(!showUserMenu())}
              class="flex items-center rounded-2xl focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 group hover-surface w-full transition-all duration-300 h-12 pl-1"
              aria-label="Menú de usuario"
              aria-expanded={showUserMenu()}
              aria-haspopup="menu"
            >
              {/* Logo US - Fijo 40px */}
              <div class="w-10 h-10 rounded-2xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white font-semibold text-sm shadow-sm shrink-0">
                US
              </div>

              {/* Texto - Animado */}
              <div
                classList={{
                  'flex-1 text-left overflow-hidden transition-all duration-300': true,
                  'opacity-100 max-w-[160px] pl-2': !effectiveCollapsed(),
                  'opacity-0 max-w-0 pl-0': effectiveCollapsed()
                }}
              >
                <p class="font-semibold text-sm truncate text-heading group-hover:text-primary whitespace-nowrap">{userName()}</p>
                <p class="text-muted text-xs truncate">{userRole()}</p>
              </div>

              {/* Chevron - Animado */}
              <div
                classList={{
                  'transition-all duration-300 overflow-hidden': true,
                  'opacity-100 max-w-[20px] mr-2': !effectiveCollapsed(),
                  'opacity-0 max-w-0': effectiveCollapsed()
                }}
              >
                <svg
                  classList={{
                    'w-4 h-4 text-muted transition-transform duration-200 group-hover:text-heading': true,
                    'rotate-180': showUserMenu()
                  }}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
                </svg>
              </div>
            </button>

            {/* Dropdown Menu */}
            <Show when={showUserMenu()}>
              <div
                class="absolute surface-panel rounded-xl shadow-xl z-50 overflow-hidden animate-[fadeIn_0.2s_ease-out]"
                classList={{
                  'left-full bottom-0 ml-3 w-56': effectiveCollapsed(),
                  'bottom-full left-0 mb-2 w-full': !effectiveCollapsed()
                }}
              >
                <div class="p-3 border-b border-surface bg-card-alt/50">
                  <p class="font-semibold text-sm text-heading">{userName()}</p>
                  <p class="text-xs text-muted">{userRole()}</p>
                </div>
                <div class="p-1">
                  <button onClick={handleAccountClick} class="w-full flex items-center gap-2 px-3 py-2 text-sm text-muted hover:text-heading hover:bg-card-alt rounded-lg transition-colors text-left">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                    Mi Cuenta
                  </button>
                  <button onClick={() => { navigate({ to: '/settings/sessions' }); setShowUserMenu(false); }} class="w-full flex items-center gap-2 px-3 py-2 text-sm text-muted hover:text-heading hover:bg-card-alt rounded-lg transition-colors text-left">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
                    Dispositivos
                  </button>
                  <button onClick={() => { navigate({ to: '/settings/general' }); setShowUserMenu(false); }} class="w-full flex items-center gap-2 px-3 py-2 text-sm text-muted hover:text-heading hover:bg-card-alt rounded-lg transition-colors text-left">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.065 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-1.065-2.572c-.94 1.543-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.065-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.573-1.065z" /><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                    Configuración
                  </button>
                  <div class="h-px bg-surface my-1"></div>
                  <button
                    onClick={handleLogout}
                    disabled={isLoggingOut()}
                    class="w-full flex items-center gap-2 px-3 py-2 text-sm font-semibold text-red-400 hover:bg-red-500/10 rounded-lg transition-colors text-left"
                  >
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
                    Cerrar Sesión
                  </button>
                </div>
              </div>
            </Show>
          </div>
        </div>
      </aside>
    </>
  );
};

export default Sidebar;  