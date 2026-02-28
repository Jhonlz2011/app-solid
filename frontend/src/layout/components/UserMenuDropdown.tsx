import { Component } from 'solid-js';
import { Link } from '@tanstack/solid-router';
import { UserIcon, LogoutIcon } from '@shared/ui/icons';

interface UserMenuDropdownProps {
    userName: string;
    userRole: string;
    onNavClick?: () => void;
    onLogout: () => void;
    isLoggingOut: () => boolean;
}

export const UserMenuDropdown: Component<UserMenuDropdownProps> = (props) => {
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

                <div class="h-px bg-border my-1" />

                <button
                    onClick={() => {
                        if (props.onNavClick) props.onNavClick();
                        props.onLogout();
                    }}
                    disabled={props.isLoggingOut()}
                    class="w-full flex items-center gap-2 px-3 py-2 text-sm font-semibold text-red-500 hover:bg-red-500/10 rounded-lg text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-danger focus-visible:ring-offset-1 focus-visible:ring-offset-transparent disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                >
                    <LogoutIcon class="size-4" />
                    {props.isLoggingOut() ? 'Cerrando sesión...' : 'Cerrar Sesión'}
                </button>
            </div>
        </>
    );
};
