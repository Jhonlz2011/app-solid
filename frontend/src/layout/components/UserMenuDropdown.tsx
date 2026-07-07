import { Component, Show } from 'solid-js';
import { Link } from '@tanstack/solid-router';
import { UserIcon, LogoutIcon } from '@shared/ui/icons';
import { useTheme } from '../../contexts/ThemeContext';

interface UserMenuDropdownProps {
    userName: string;
    userRole: string;
    onNavClick?: () => void;
    onLogout: () => void;
    isLoggingOut: () => boolean;
}

export const UserMenuDropdown: Component<UserMenuDropdownProps> = (props) => {
    const { theme, toggleTheme } = useTheme();

    return (
        <>
            <div class="p-3 border-b border-border bg-card-alt/50">
                <p class="font-semibold text-sm text-heading truncate">{props.userName}</p>
                <p class="text-xs text-muted truncate">{props.userRole}</p>
            </div>
            
            <div class="p-1">
                <Link
                    to="/profile"
                    onClick={() => {
                        if (props.onNavClick) props.onNavClick();
                    }}
                    preload="intent"
                    class="w-full flex items-center gap-2 px-3 py-2 text-sm text-muted hover:text-heading hover:bg-card-alt rounded-lg text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 focus-visible:ring-offset-transparent"
                >
                    <UserIcon class="size-4" />
                    Mi Cuenta
                </Link>

                <button
                    onClick={toggleTheme}
                    class="w-full flex items-center justify-between px-3 py-2 text-sm text-muted hover:text-heading hover:bg-card-alt rounded-lg text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 focus-visible:ring-offset-transparent cursor-pointer"
                >
                    <div class="flex items-center gap-2">
                        <Show
                            when={theme() === 'light'}
                            fallback={
                                <svg class="size-4 animate-in spin-in duration-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20.354 15.354A9 9 0 018.646 3.646 9 9 0 1020.354 15.354z" />
                                </svg>
                            }
                        >
                            <svg class="size-4 animate-in spin-in duration-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364-6.364l-.707.707M6.343 17.657l-.707.707m0-12.728l.707.707M17.657 17.657l.707.707M12 8a4 4 0 100 8 4 4 0 000-8z" />
                            </svg>
                        </Show>
                        <span>Tema</span>
                    </div>
                    <span class="text-[10px] bg-card border border-border px-1.5 py-0.5 rounded text-muted capitalize font-medium">
                        {theme() === 'light' ? 'Claro' : 'Oscuro'}
                    </span>
                </button>

                <div class="h-px bg-border my-1" />

                <button
                    onClick={() => {
                        if (props.onNavClick) props.onNavClick();
                        props.onLogout();
                    }}
                    disabled={props.isLoggingOut()}
                    class="w-full flex items-center gap-2 px-3 py-2 text-sm font-semibold text-danger hover:bg-danger/10 rounded-lg text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-danger focus-visible:ring-offset-1 focus-visible:ring-offset-transparent disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                >
                    <LogoutIcon class="size-4" />
                    {props.isLoggingOut() ? 'Cerrando sesión...' : 'Cerrar Sesión'}
                </button>
            </div>
        </>
    );
};
