import { Component, createContext, useContext, JSX } from 'solid-js';
import Sidebar from './Sidebar';

interface LayoutContextValue {
  openMobileMenu: () => void;
}

const LayoutContext = createContext<LayoutContextValue>();

export const useLayout = () => {
  const context = useContext(LayoutContext);
  if (!context) {
    throw new Error('useLayout must be used within Layout');
  }
  return context;
};

interface LayoutProps {
  children: JSX.Element;
}

const Layout: Component<LayoutProps> = (props) => {
  const openMobileMenu = () => {
    // Dispatch event to open sidebar on mobile
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('open-sidebar'));
    }
  };

  return (
    <LayoutContext.Provider value={{ openMobileMenu }}>
      <div class="min-h-screen app-shell flex h-screen overflow-hidden relative">
        <Sidebar />

        {/* Main Content */}
        <div class="flex-1 flex flex-col lg:ml-0 overflow-hidden">
          {/* Mobile Header */}
          <header class="sm:hidden bg-surface border-surface border-b px-4 py-3 flex items-center justify-between sticky top-0 z-30">
            <button
              onClick={openMobileMenu}
              class="text-muted hover-surface rounded-xl p-2"
            >
              <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
            <h1 class="font-bold text-lg">Dashboard</h1>
            <div class="w-10" /> {/* Spacer for centering */}
          </header>

          {/* Content Area */}
          <main class="flex-1 overflow-y-auto">
            {props.children}
          </main>
        </div>
      </div>
    </LayoutContext.Provider>
  );
};

export default Layout;

