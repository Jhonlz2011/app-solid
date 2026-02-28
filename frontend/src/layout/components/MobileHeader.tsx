import { Component, createSignal, Show } from 'solid-js';
import { Portal } from 'solid-js/web';
import { useAuth } from '@modules/auth/store/auth.store';
import { getAvatarGradientStyle, getInitials } from '@shared/utils/avatar';
import { useMobileSidebar } from '@shared/store/layout.store';
import { clickOutside } from '@shared/directives/clickOutside';
import { useLogout } from '@modules/auth/hooks/useLogout';
import { UserMenuDropdown } from './UserMenuDropdown';

// Register directive
false && clickOutside;

const MobileHeader: Component = () => {
    const auth = useAuth();
    const { open: openSidebar } = useMobileSidebar();
    const [showUserMenu, setShowUserMenu] = createSignal(false);
    
    const { handleLogout, isLoggingOut } = useLogout();
    
    const userName = () => auth.user()?.username || 'Usuario';
    const userRole = () => auth.user()?.roles?.[0] || 'Usuario';

    const handleNavClick = () => {
        setShowUserMenu(false);
    };

    return (
        <header class="bg-surface/95 backdrop-blur-[12px] border-b border-border pt-[env(safe-area-inset-top)] sm:hidden fixed top-0 left-0 right-0 h-14 z-30 flex items-center justify-between px-4">
            <button
                onClick={openSidebar}
                class="flex items-center justify-center w-10 h-10 rounded-xl text-muted hover:text-heading hover:bg-card-alt transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
                aria-label="Abrir menú de navegación"
            >
                <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16" />
                </svg>
            </button>

            <div class="relative" use:clickOutside={() => setShowUserMenu(false)}>
                <button
                    onClick={() => setShowUserMenu(!showUserMenu())}
                    class="w-9 h-9 rounded-xl flex items-center justify-center text-white font-semibold text-xs shadow-sm hover:opacity-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary cursor-pointer"
                    style={getAvatarGradientStyle(userName())}
                    aria-label="Menú de usuario"
                    aria-expanded={showUserMenu()}
                    aria-haspopup="menu"
                >
                    {getInitials(userName())}
                </button>

                <Show when={showUserMenu()}>
                    <Portal>
                        {/* 
                          We position it fixed relative to the screen.
                          Since it's mobile, we can put it right below the header on the right side.
                        */}
                        <div
                            role="menu"
                            class="sm:hidden fixed bg-surface border border-border rounded-xl shadow-xl z-[100] overflow-hidden animate-in fade-in slide-in-from-top-2"
                            style={{ 
                                top: 'calc(3.5rem + env(safe-area-inset-top) + 0.5rem)', 
                                right: '1rem',
                                width: '14rem'
                            }}
                        >
                            <UserMenuDropdown 
                                userName={userName()}
                                userRole={userRole()}
                                onNavClick={handleNavClick}
                                onLogout={handleLogout}
                                isLoggingOut={isLoggingOut}
                            />
                        </div>
                    </Portal>
                </Show>
            </div>
        </header>
    );
};

export default MobileHeader;
