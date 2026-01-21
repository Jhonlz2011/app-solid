import { Component } from 'solid-js';
import { useAuth } from '@modules/auth/auth.store';
import { getAvatarGradientStyle, getInitials } from '@shared/utils/avatar';

const MobileHeader: Component = () => {
    const auth = useAuth();
    const userName = () => auth.user()?.username || 'Usuario';

    const openSidebar = () => {
        window.dispatchEvent(new Event('open-sidebar'));
    };

    return (
        <header class="bg-surface/95 backdrop-blur-[12px] border-b border-border pt-[env(safe-area-inset-top)] sm:hidden fixed top-0 left-0 right-0 h-14 z-30 flex items-center justify-between px-4">
            {/* Hamburger Button */}
            <button
                onClick={openSidebar}
                class="flex items-center justify-center w-10 h-10 rounded-xl text-muted hover:text-heading hover:bg-card-alt transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
                aria-label="Abrir menú de navegación"
            >
                <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16" />
                </svg>
            </button>

            {/* User Avatar - Dynamic gradient based on username */}
            <div
                class="w-9 h-9 rounded-xl flex items-center justify-center text-white font-semibold text-xs shadow-sm"
                style={getAvatarGradientStyle(userName())}
            >
                {getInitials(userName())}
            </div>
        </header>
    );
};

export default MobileHeader;

