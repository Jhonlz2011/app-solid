import { Component, Show, createSignal } from 'solid-js';
import { Portal } from 'solid-js/web';
import { getAvatarGradientStyle, getInitials } from '@shared/utils/avatar';
import { useSidebar } from './SidebarContext';
import { clickOutside } from '@shared/directives/clickOutside';
import { UserIcon, LogoutIcon } from '@shared/components/icons';

// Register directive
false && clickOutside;

interface SidebarFooterProps {
    userName: string;
    userRole: string;
    onLogout: () => void;
    isLoggingOut: () => boolean;
}

export const SidebarFooter: Component<SidebarFooterProps> = (props) => {
    const { collapsed, handleNavigation } = useSidebar();
    const [showUserMenu, setShowUserMenu] = createSignal(false);

    const handleAccountClick = () => {
        handleNavigation('/');
        setShowUserMenu(false);
    };

    const handleLogout = () => {
        props.onLogout();
        // Don't close menu immediately, let logout complete
    };

    return (
        <footer
            class="hidden sm:block relative border-t border-border h-20 shrink-0 mt-auto"
            tabIndex={-1}
            use:clickOutside={() => setShowUserMenu(false)}
        >
            {/* AVATAR LAYER - Always visible, no opacity transition */}
            <div class="absolute inset-0 flex items-center px-4 sm:pl-5 pointer-events-none z-10">
                <div
                    class="size-10 rounded-xl flex items-center justify-center text-white font-semibold text-sm shadow-sm shrink-0"
                    style={getAvatarGradientStyle(props.userName)}
                >
                    {getInitials(props.userName)}
                </div>
            </div>

            {/* COLLAPSED CONTENT LAYER - Only dropdown button */}
            <div
                class="absolute inset-0 flex items-center px-4 sm:pl-5 transition-opacity duration-200"
                classList={{
                    'opacity-100': collapsed(),
                    'opacity-0 pointer-events-none': !collapsed()
                }}
                inert={!collapsed()}
            >
                <div class="relative size-10">
                    <button
                        onClick={() => setShowUserMenu(!showUserMenu())}
                        class="absolute inset-0 flex items-center justify-center rounded-xl 
                               focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 focus-visible:ring-offset-transparent
                               pointer-events-auto"
                        aria-label="Menú de usuario"
                        aria-expanded={showUserMenu()}
                        aria-haspopup="menu"
                    />

                    {/* Dropdown Menu (Collapsed) - Desktop only */}
                    <Show when={showUserMenu()}>
                        <Portal>
                            <div
                                role="menu"
                                class="hidden sm:block fixed w-56 bg-surface border border-border rounded-xl shadow-xl z-[100] overflow-hidden animate-in "
                                style={{
                                    left: '4.6rem',
                                    bottom: '1rem'
                                }}
                            >
                                <div class="p-3 border-b border-border bg-card-alt/50">
                                    <p class="font-semibold text-sm text-heading">{props.userName}</p>
                                    <p class="text-xs text-muted">{props.userRole}</p>
                                </div>
                                <div class="p-1">
                                    <button
                                        tabIndex={0}
                                        onClick={handleAccountClick}
                                        class="w-full flex items-center gap-2 px-3 py-2 text-sm text-muted hover:text-heading hover:bg-card-alt rounded-lg text-left
                                               focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 focus-visible:ring-offset-transparent"
                                    >
                                        <UserIcon class="size-4" />
                                        Mi Cuenta
                                    </button>

                                    <div class="h-px bg-border my-1" />

                                    <button
                                        tabIndex={0}
                                        onClick={handleLogout}
                                        disabled={props.isLoggingOut()}
                                        class="w-full flex items-center gap-2 px-3 py-2 text-sm font-semibold text-red-500 hover:bg-red-500/10 rounded-lg text-left
                                               focus:outline-none focus-visible:ring-2 focus-visible:ring-danger focus-visible:ring-offset-1 focus-visible:ring-offset-transparent
                                               disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        <LogoutIcon class="size-4" />
                                        {props.isLoggingOut() ? 'Cerrando sesión...' : 'Cerrar Sesión'}
                                    </button>
                                </div>
                            </div>
                        </Portal>
                    </Show>
                </div>
            </div>

            {/* EXPANDED CONTENT LAYER - User info and logout button */}
            <Show when={!collapsed()}>
                <div class="absolute inset-0 flex items-center gap-2 px-4 sm:pl-5 sm:pr-4 animate-in fade-in duration-200">
                    {/* Profile Button (Avatar + Info) - Avatar is hidden here (covered by layer above) */}
                    <button
                        onClick={handleAccountClick}
                        class="flex-1 flex items-center gap-3 rounded-xl cursor-pointer text-left group items-start 
                               focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 focus-visible:ring-offset-transparent"
                        aria-label="Ir a mi perfil"
                    >
                        {/* Invisible spacer for avatar */}
                        <div class="size-10 shrink-0 opacity-0" />

                        <div class="flex-1 overflow-hidden">
                            <p class="font-semibold text-sm truncate text-heading group-hover:text-primary">
                                {props.userName}
                            </p>
                            <p class="text-muted text-xs truncate">{props.userRole}</p>
                        </div>
                    </button>

                    {/* Logout Button */}
                    <button
                        onClick={handleLogout}
                        disabled={props.isLoggingOut()}
                        class="group/logout flex items-center justify-center gap-2 p-2.5 rounded-xl
                               focus:outline-none focus-visible:ring-2 focus-visible:ring-danger focus-visible:ring-offset-1 focus-visible:ring-offset-transparent"
                        classList={{
                            'text-red-500/70 hover:bg-red-500/10 hover:text-red-500': !props.isLoggingOut(),
                            'opacity-50 cursor-not-allowed text-red-500/50': props.isLoggingOut()
                        }}
                        title="Cerrar Sesión"
                        aria-label="Cerrar Sesión"
                    >
                        <LogoutIcon
                            class={`size-5 ${!props.isLoggingOut() ? 'group-hover/logout:rotate-12' : 'animate-pulse'}`}
                        />
                    </button>
                </div>
            </Show>
        </footer>
    );
};