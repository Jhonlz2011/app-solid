import { Component, Show } from 'solid-js';
import { Link } from '@tanstack/solid-router';
import { Avatar } from '@display/Avatar';
import ThemeToggle from '../ThemeToggle';
import { useSidebar } from './SidebarContext';
import { LogoutIcon } from '@icons/LogoutIcon';
import { useLogout } from '@modules/auth/hooks/useLogout';
import { UserMenuDropdown } from '../UserMenuDropdown';
import { DropdownMenu } from '@display/DropdownMenu';
import Button from '@form/Button';

interface SidebarFooterProps {
    userName: string;
    userRole: string;
    userImage?: string | null;
}

export const SidebarFooter: Component<SidebarFooterProps> = (props) => {
    const { collapsed, isMobileViewport, setIsMobileOpen } = useSidebar();
    const { handleLogout, isLoggingOut } = useLogout();

    const name = () => props.userName || 'Usuario';
    const role = () => props.userRole || 'Usuario';

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
                <Avatar
                    name={name()}
                    src={props.userImage}
                    size="md"
                    shape="rounded"
                    class="size-10 rounded-xl shadow-xs"
                />
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
                                userName={name()}
                                userRole={role()}
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
                <div class="absolute inset-0 flex items-center gap-1.5 px-4 sm:pl-5 sm:pr-4 animate-in fade-in duration-200">
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
                                {name()}
                            </p>
                            <p class="text-muted text-xs truncate">{role()}</p>
                        </div>
                    </Link>

                    <ThemeToggle collapsed={collapsed()} />

                    <Button
                        variant="ghost-danger"
                        size="icon_sm"
                        radius="lg"
                        onClick={handleLogout}
                        disabled={isLoggingOut()}
                        loading={isLoggingOut()}
                        title="Cerrar Sesión"
                        class='text-danger'
                        aria-label="Cerrar Sesión"
                        icon={<LogoutIcon class="size-5" />}
                    />
                </div>
            </Show>
        </footer>
    );
};