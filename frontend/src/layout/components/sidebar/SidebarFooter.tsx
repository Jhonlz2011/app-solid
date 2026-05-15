import { Component, Show } from 'solid-js';
import { Link } from '@tanstack/solid-router';
import { getAvatarGradientStyle, getInitials } from '@shared/utils/avatar';
import { useSidebar } from './SidebarContext';
import { LogoutIcon } from '@shared/ui/icons';
import { useLogout } from '@modules/auth/hooks/useLogout';
import { UserMenuDropdown } from '../UserMenuDropdown';
import { DropdownMenu } from '@shared/ui/DropdownMenu';
import Button from '@shared/ui/Button';

interface SidebarFooterProps {
    userName: string;
    userRole: string;
}

export const SidebarFooter: Component<SidebarFooterProps> = (props) => {
    const { collapsed, isMobileViewport, setIsMobileOpen } = useSidebar();
    const { handleLogout, isLoggingOut } = useLogout();

    const handleNavClick = () => {
        if (isMobileViewport()) setIsMobileOpen(false);
    };

    return (
        <footer
            class="hidden sm:block relative border-t border-border h-18 shrink-0 mt-auto"
            tabIndex={-1}
        >
            {/* Avatar — always visible, on top */}
            <div class="absolute inset-0 flex items-center px-4 sm:pl-5 pointer-events-none z-10">
                <div
                    class="size-10 rounded-xl flex items-center justify-center text-white font-semibold text-sm shadow-sm shrink-0"
                    style={getAvatarGradientStyle(props.userName)}
                >
                    {getInitials(props.userName)}
                </div>
            </div>

            {/* COLLAPSED: avatar doubles as menu trigger → DropdownMenu */}
            <Show when={collapsed()}>
                <div class="absolute inset-0 flex items-center px-4 sm:pl-5">
                    <DropdownMenu placement="right" gutter={14}>
                        <DropdownMenu.Trigger 
                            class="relative size-10 rounded-xl focus-visible:ring-offset-1 pointer-events-auto"
                            aria-label="Menú de usuario"
                        >
                            {/* The trigger needs to be the same size as the avatar to overlay it perfectly */}
                            <span class="sr-only">Abrir menú de usuario</span>
                        </DropdownMenu.Trigger>
                        <DropdownMenu.Content class="w-56 mb-2 p-0">
                            <UserMenuDropdown
                                userName={props.userName}
                                userRole={props.userRole}
                                onNavClick={handleNavClick}
                                onLogout={handleLogout}
                                isLoggingOut={isLoggingOut}
                            />
                        </DropdownMenu.Content>
                    </DropdownMenu>
                </div>
            </Show>

            {/* EXPANDED: inline profile link + logout button */}
            <Show when={!collapsed()}>
                <div class="absolute inset-0 flex items-center gap-2 px-4 sm:pl-5 sm:pr-4 animate-in fade-in duration-200">
                    <Link
                        to="/profile"
                        onClick={handleNavClick}
                        preload="intent"
                        class="flex-1 min-w-0 flex items-center gap-3 rounded-xl cursor-pointer text-left group
                               focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 focus-visible:ring-offset-transparent"
                        aria-label="Ir a mi perfil"
                    >
                        {/* Invisible spacer for avatar (covered by layer above) */}
                        <div class="size-10 shrink-0 opacity-0" />
                        <div class="flex-1 min-w-0">
                            <p class="font-semibold text-sm truncate text-heading group-hover:text-primary">
                                {props.userName}
                            </p>
                            <p class="text-muted text-xs truncate">{props.userRole}</p>
                        </div>
                    </Link>

                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={handleLogout}
                        disabled={isLoggingOut()}
                        loading={isLoggingOut()}
                        class="text-danger hover:text-danger hover:bg-danger/10 focus-visible:ring-danger/55 focus-visible:ring-2 focus-visible:ring-offset-transparent"
                        title="Cerrar Sesión"
                        aria-label="Cerrar Sesión"
                    >
                        <Show when={!isLoggingOut()}>
                            <LogoutIcon class="size-5" />
                        </Show>
                    </Button>
                </div>
            </Show>
        </footer>
    );
};