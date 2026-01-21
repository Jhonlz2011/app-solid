import { Component, createSignal, Show, For, createEffect, onCleanup, Accessor, on, Index } from 'solid-js';
import { Portal } from 'solid-js/web';
import { useNavigate, useLocation, Link } from '@tanstack/solid-router';
import { useAuth, actions as authActions } from '@modules/auth/auth.store';
import SimpleBar from 'simplebar';
import 'simplebar/dist/simplebar.css';
import ThemeToggle from './ThemeToggle';
import { useModules } from '../../shared/store/modules.store';
import { SidebarItem, MenuItem } from './SidebarItem';
import { getAvatarGradientStyle, getInitials } from '@shared/utils/avatar';

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

  // Block body scroll when mobile sidebar is open
  createEffect(() => {
    if (typeof document === 'undefined') return;
    if (isMobileOpen()) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
  });

  // Touch gesture handling for swipe-to-close
  let touchStartX = 0;
  let sidebarRef: HTMLElement | undefined;

  const handleTouchStart = (e: TouchEvent) => {
    touchStartX = e.touches[0].clientX;
  };

  const handleTouchEnd = (e: TouchEvent) => {
    if (!isMobileOpen()) return;
    const touchEndX = e.changedTouches[0].clientX;
    const diff = touchStartX - touchEndX;

    // Close sidebar if swiped left more than 80px
    if (diff > 80) {
      setIsMobileOpen(false);
    }
  };

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
          style={{ 'touch-action': 'none' }}
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
        ref={el => sidebarRef = el}
        role="complementary"
        aria-label={effectiveCollapsed() ? 'Navegación lateral colapsada' : 'Navegación lateral'}
        class="fixed top-0 left-0 h-screen bg-surface border-r border-border z-50 w-64 flex flex-col overflow-visible sm:static sm:z-auto max-sm:pt-[env(safe-area-inset-top)] max-sm:pb-[env(safe-area-inset-bottom)]"
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
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        {/* Logo/Header */}
        <div class="border-b border-surface relative h-[90px]" tabIndex={-1}>
          {/* LOGO LAYER - Always visible, no opacity transition */}
          <div class="absolute inset-0 flex items-center px-4 sm:pl-5 pointer-events-none">
            <div class="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center shrink-0">
              <span class="text-white font-bold text-lg">A</span>
            </div>
          </div>

          {/* COLLAPSED CONTENT LAYER - Only expand button (hover only) */}
          <div
            classList={{
              'absolute inset-0 flex items-center px-4 sm:pl-5 transition-opacity duration-200': true,
              'opacity-100': effectiveCollapsed(),
              'opacity-0 pointer-events-none': !effectiveCollapsed()
            }}
            inert={!effectiveCollapsed()}
          >
            <div class="relative w-10 h-10 shrink-0">
              {/* Expand button (visible on hover when collapsed) - Desktop only */}
              <button
                onClick={toggleCollapse}
                class="peer absolute inset-0 w-10 h-10 hidden sm:flex items-center justify-center text-muted hover:text-primary opacity-0 hover:opacity-100 focus-visible:opacity-100 transition-opacity duration-200 rounded-lg hover:bg-card-alt focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-1 focus-visible:ring-offset-transparent z-10 pointer-events-auto"
                title="Expandir sidebar"
                aria-label="Expandir sidebar"
              >
                <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M6.83496 3.99992C6.38353 4.00411 6.01421 4.0122 5.69824 4.03801C5.31232 4.06954 5.03904 4.12266 4.82227 4.20012L4.62207 4.28606C4.18264 4.50996 3.81498 4.85035 3.55859 5.26848L3.45605 5.45207C3.33013 5.69922 3.25006 6.01354 3.20801 6.52824C3.16533 7.05065 3.16504 7.71885 3.16504 8.66301V11.3271C3.16504 12.2712 3.16533 12.9394 3.20801 13.4618C3.25006 13.9766 3.33013 14.2909 3.45605 14.538L3.55859 14.7216C3.81498 15.1397 4.18266 15.4801 4.62207 15.704L4.82227 15.79C5.03904 15.8674 5.31234 15.9205 5.69824 15.9521C6.01398 15.9779 6.383 15.986 6.83398 15.9902L6.83496 3.99992ZM18.165 11.3271C18.165 12.2493 18.1653 12.9811 18.1172 13.5702C18.0745 14.0924 17.9916 14.5472 17.8125 14.9648L17.7295 15.1415C17.394 15.8 16.8834 16.3511 16.2568 16.7353L15.9814 16.8896C15.5157 17.1268 15.0069 17.2285 14.4102 17.2773C13.821 17.3254 13.0893 17.3251 12.167 17.3251H7.83301C6.91071 17.3251 6.17898 17.3254 5.58984 17.2773C5.06757 17.2346 4.61294 17.1508 4.19531 16.9716L4.01855 16.8896C3.36014 16.5541 2.80898 16.0434 2.4248 15.4169L2.27051 15.1415C2.03328 14.6758 1.93158 14.167 1.88281 13.5702C1.83468 12.9811 1.83496 12.2493 1.83496 11.3271V8.66301C1.83496 7.74072 1.83468 7.00898 1.88281 6.41985C1.93157 5.82309 2.03329 5.31432 2.27051 4.84856L2.4248 4.57317C2.80898 3.94666 3.36012 3.436 4.01855 3.10051L4.19531 3.0175C4.61285 2.83843 5.06771 2.75548 5.58984 2.71281C6.17898 2.66468 6.91071 2.66496 7.83301 2.66496H12.167C13.0893 2.66496 13.821 2.66468 14.4102 2.71281C15.0069 2.76157 15.5157 2.86329 15.9814 3.10051L16.2568 3.25481C16.8833 3.63898 17.394 4.19012 17.7295 4.84856L17.8125 5.02531C17.9916 5.44285 18.0745 5.89771 18.1172 6.41985C18.1653 7.00898 18.165 7.74072 18.165 8.66301V11.3271ZM8.16406 15.995H12.167C13.1112 15.995 13.7794 15.9947 14.3018 15.9521C14.8164 15.91 15.1308 15.8299 15.3779 15.704L15.5615 15.6015C15.9797 15.3451 16.32 14.9774 16.5439 14.538L16.6299 14.3378C16.7074 14.121 16.7605 13.8478 16.792 13.4618C16.8347 12.9394 16.835 12.2712 16.835 11.3271V8.66301C16.835 7.71885 16.8347 7.05065 16.792 6.52824C16.7605 6.14232 16.7073 5.86904 16.6299 5.65227L16.5439 5.45207C16.32 5.01264 15.9796 4.64498 15.5615 4.3886L15.3779 4.28606C15.1308 4.16013 14.8165 4.08006 14.3018 4.03801C13.7794 3.99533 13.1112 3.99504 12.167 3.99504H8.16406C8.16407 3.99667 8.16504 3.99829 8.16504 3.99992L8.16406 15.995Z" />
                </svg>
              </button>
            </div>
          </div>

          {/* EXPANDED CONTENT LAYER - Text and buttons with opacity transition */}
          <div
            classList={{
              'absolute inset-0 flex items-center justify-between transition-opacity duration-200': true,
              'px-4 sm:pl-5 sm:pr-4': true,
              'opacity-100': !effectiveCollapsed(),
              'opacity-0 pointer-events-none': effectiveCollapsed()
            }}
            inert={effectiveCollapsed()}
            tabIndex={-1}
          >
            {/* Logo + Text - Logo is hidden here (covered by always-visible layer) */}
            <div class="flex items-center gap-3 min-w-0">
              {/* Invisible spacer for logo */}
              <div class="w-10 h-10 shrink-0 opacity-0"></div>

              <div class="flex flex-col justify-center overflow-hidden">
                <h2 class="font-bold text-lg whitespace-nowrap">App</h2>
                <p class="text-muted text-xs whitespace-nowrap">Dashboard</p>
              </div>
            </div>

            {/* Right side buttons */}
            <div class="flex items-center gap-2">
              <ThemeToggle collapsed={effectiveCollapsed()} />
              <Show when={!isCollapsed()}>
                <button
                  onClick={toggleCollapse}
                  class="hidden sm:flex items-center justify-center text-muted hover:bg-card-alt hover:text-text p-2 rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-1 focus-visible:ring-offset-transparent"
                  title="Colapsar sidebar"
                  aria-label="Colapsar sidebar"
                >
                  <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M6.83496 3.99992C6.38353 4.00411 6.01421 4.0122 5.69824 4.03801C5.31232 4.06954 5.03904 4.12266 4.82227 4.20012L4.62207 4.28606C4.18264 4.50996 3.81498 4.85035 3.55859 5.26848L3.45605 5.45207C3.33013 5.69922 3.25006 6.01354 3.20801 6.52824C3.16533 7.05065 3.16504 7.71885 3.16504 8.66301V11.3271C3.16504 12.2712 3.16533 12.9394 3.20801 13.4618C3.25006 13.9766 3.33013 14.2909 3.45605 14.538L3.55859 14.7216C3.81498 15.1397 4.18266 15.4801 4.62207 15.704L4.82227 15.79C5.03904 15.8674 5.31234 15.9205 5.69824 15.9521C6.01398 15.9779 6.383 15.986 6.83398 15.9902L6.83496 3.99992ZM18.165 11.3271C18.165 12.2493 18.1653 12.9811 18.1172 13.5702C18.0745 14.0924 17.9916 14.5472 17.8125 14.9648L17.7295 15.1415C17.394 15.8 16.8834 16.3511 16.2568 16.7353L15.9814 16.8896C15.5157 17.1268 15.0069 17.2285 14.4102 17.2773C13.821 17.3254 13.0893 17.3251 12.167 17.3251H7.83301C6.91071 17.3251 6.17898 17.3254 5.58984 17.2773C5.06757 17.2346 4.61294 17.1508 4.19531 16.9716L4.01855 16.8896C3.36014 16.5541 2.80898 16.0434 2.4248 15.4169L2.27051 15.1415C2.03328 14.6758 1.93158 14.167 1.88281 13.5702C1.83468 12.9811 1.83496 12.2493 1.83496 11.3271V8.66301C1.83496 7.74072 1.83468 7.00898 1.88281 6.41985C1.93157 5.82309 2.03329 5.31432 2.27051 4.84856L2.4248 4.57317C2.80898 3.94666 3.36012 3.436 4.01855 3.10051L4.19531 3.0175C4.61285 2.83843 5.06771 2.75548 5.58984 2.71281C6.17898 2.66468 6.91071 2.66496 7.83301 2.66496H12.167C13.0893 2.66496 13.821 2.66468 14.4102 2.71281C15.0069 2.76157 15.5157 2.86329 15.9814 3.10051L16.2568 3.25481C16.8833 3.63898 17.394 4.19012 17.7295 4.84856L17.8125 5.02531C17.9916 5.44285 18.0745 5.89771 18.1172 6.41985C18.1653 7.00898 18.165 7.74072 18.165 8.66301V11.3271ZM8.16406 15.995H12.167C13.1112 15.995 13.7794 15.9947 14.3018 15.9521C14.8164 15.91 15.1308 15.8299 15.3779 15.704L15.5615 15.6015C15.9797 15.3451 16.32 14.9774 16.5439 14.538L16.6299 14.3378C16.7074 14.121 16.7605 13.8478 16.792 13.4618C16.8347 12.9394 16.835 12.2712 16.835 11.3271V8.66301C16.835 7.71885 16.8347 7.05065 16.792 6.52824C16.7605 6.14232 16.7073 5.86904 16.6299 5.65227L16.5439 5.45207C16.32 5.01264 15.9796 4.64498 15.5615 4.3886L15.3779 4.28606C15.1308 4.16013 14.8165 4.08006 14.3018 4.03801C13.7794 3.99533 13.1112 3.99504 12.167 3.99504H8.16406C8.16407 3.99667 8.16504 3.99829 8.16504 3.99992L8.16406 15.995Z" />
                  </svg>
                </button>
              </Show>

              {/* Botón para cerrar - Solo mobile */}
              <button
                onClick={() => setIsMobileOpen(false)}
                class="sm:hidden text-muted hover:bg-card-alt hover:text-text p-2 rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-1 focus-visible:ring-offset-transparent"
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
          class="hidden sm:block relative border-t border-surface h-20"
          tabIndex={-1}
          ref={userMenuRef}
        >
          {/* AVATAR LAYER - Always visible, no opacity transition */}
          <div class="absolute inset-0 flex items-center px-4 sm:pl-5 pointer-events-none z-10">
            <div
              class="w-10 h-10 rounded-xl flex items-center justify-center text-white font-semibold text-sm shadow-sm shrink-0"
              style={getAvatarGradientStyle(userName())}
            >
              {getInitials(userName())}
            </div>
          </div>

          {/* COLLAPSED CONTENT LAYER - Only dropdown button */}
          <div
            classList={{
              'absolute inset-0 flex items-center px-4 sm:pl-5 transition-opacity duration-200': true,
              'opacity-100': effectiveCollapsed(),
              'opacity-0 pointer-events-none': !effectiveCollapsed()
            }}
            inert={!effectiveCollapsed()}
          >
            <div class="relative w-10 h-10">
              <button
                onClick={() => setShowUserMenu(!showUserMenu())}
                class="absolute inset-0 flex items-center justify-center rounded-2xl focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 pointer-events-auto"
                aria-label="Menú de usuario"
                aria-expanded={showUserMenu()}
                aria-haspopup="menu"
              >
              </button>

              {/* Dropdown Menu (Collapsed) - Desktop only */}
              <Show when={showUserMenu()}>
                <Portal>
                  <div
                    class="hidden sm:block fixed w-56 bg-surface border border-border rounded-xl shadow-xl z-[100] overflow-hidden animate-[fadeIn_0.2s_ease-out]"
                    style={{
                      left: `4.6rem`,
                      bottom: `1rem`
                    }}
                  >
                    <div class="p-3 border-b border-surface bg-card-alt/50">
                      <p class="font-semibold text-sm text-heading">{userName()}</p>
                      <p class="text-xs text-muted">{userRole()}</p>
                    </div>
                    <div class="p-1">
                      <button onClick={handleAccountClick} class="w-full flex items-center gap-2 px-3 py-2 text-sm text-muted hover:text-heading hover:bg-card-alt rounded-lg text-left">
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                        Mi Cuenta
                      </button>

                      <div class="h-px bg-surface my-1"></div>
                      <button
                        onClick={handleLogout}
                        disabled={isLoggingOut()}
                        class="w-full flex items-center gap-2 px-3 py-2 text-sm font-semibold text-red-500 hover:bg-red-500/10 rounded-lg text-left"
                      >
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
                        Cerrar Sesión
                      </button>
                    </div>
                  </div>
                </Portal>
              </Show>
            </div>
          </div>

          {/* EXPANDED CONTENT LAYER - User info and logout button with opacity transition */}
          <Show when={!effectiveCollapsed()}>
            <div
              class="absolute inset-0 flex items-center gap-2 px-4 sm:pl-5 sm:pr-4 animate-in fade-in duration-200"
            >
              {/* Profile Button (Avatar + Info) - Avatar is hidden here */}
              <button
                onClick={handleAccountClick}
                class="flex-1 flex items-center gap-3 rounded-xl cursor-pointer text-left group focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                aria-label="Ir a mi perfil"
              >
                {/* Invisible spacer for avatar */}
                <div class="w-10 h-10 shrink-0 opacity-0"></div>

                <div class="flex-1 overflow-hidden">
                  <p class="font-semibold text-sm truncate text-heading group-hover:text-primary">{userName()}</p>
                  <p class="text-muted text-xs truncate">{userRole()}</p>
                </div>
              </button>

              {/* Logout Button */}
              <button
                onClick={handleLogout}
                disabled={isLoggingOut()}
                classList={{
                  'group/logout flex items-center justify-center gap-2 px-3 py-2 rounded-xl transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-400': true,
                  'text-red-500/70 hover:bg-red-500/10': !isLoggingOut(),
                  'opacity-50 cursor-not-allowed border border-red-400/10 text-red-500/50': isLoggingOut()
                }}
                title="Cerrar Sesión"
                aria-label="Cerrar Sesión"
              >
                <svg
                  classList={{
                    'w-5 h-5 transition-transform duration-200': true,
                    'group-hover/logout:rotate-12': !isLoggingOut()
                  }}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
              </button>
            </div>
          </Show>
        </div>
      </aside>
    </>
  );
};

export default Sidebar;