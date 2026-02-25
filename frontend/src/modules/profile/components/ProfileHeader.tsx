// Profile Header Component
import { Component, For, createMemo } from 'solid-js';
import { getAvatarGradientStyle, getInitials } from '@shared/utils/avatar';
import type { Profile } from '../models/profile.types';
import { Badge, RoleBadge } from '@shared/ui/Badge';
import { useAuth } from '@modules/auth/store/auth.store';

interface ProfileHeaderProps {
    profile: Profile;
}

export const ProfileHeader: Component<ProfileHeaderProps> = (props) => {
    // Read from auth.store — updated in real-time by the WS listener.
    // This means the header reacts instantly to cross-tab profile changes
    // without waiting for a TanStack Query refetch.
    const auth = useAuth();

    const displayName = createMemo(() =>
        props.profile.entity?.business_name || auth.user()?.username || props.profile.email
    );

    const avatarStyle = createMemo(() => getAvatarGradientStyle(displayName()));
    const initials = createMemo(() => getInitials(displayName()));

    const formatDate = (dateStr: string | null) => {
        if (!dateStr) return 'Nunca';
        const d = new Date(dateStr);
        return d.toLocaleDateString('es-EC', {
            day: 'numeric',
            month: 'long',
            year: 'numeric',
        });
    };

    return (
        <div class="mb-8">
            <div class="flex flex-col sm:flex-row items-center gap-5">
                {/* Large Avatar - Now reactive to name changes */}
                <div
                    class="size-20 sm:size-24 rounded-2xl flex items-center justify-center text-white font-bold text-2xl sm:text-3xl shadow-lg shrink-0"
                    style={avatarStyle()}
                >
                    {initials()}
                </div>

                {/* User Info */}
                <div class="flex-1 text-center sm:text-left">
                    <h1 class="text-2xl sm:text-3xl font-bold text-heading mb-1">
                        {displayName()}
                    </h1>
                    <p class="text-muted text-sm sm:text-base mb-3">
                        @{auth.user()?.username || props.profile.username} · {props.profile.email}
                    </p>

                    {/* Badges */}
                    <div class="flex flex-wrap justify-center sm:justify-start gap-2">
                        <For each={props.profile.roles ?? []}>
                            {(role) => <RoleBadge name={role} />}
                        </For>
                        {props.profile.entity?.is_employee && (
                            <Badge variant="success">Empleado</Badge>
                        )}
                        {props.profile.entity?.is_client && (
                            <Badge variant="info">Cliente</Badge>
                        )}
                    </div>
                </div>

                {/* Last Login */}
                <div class="text-center sm:text-right text-sm text-muted hidden md:block">
                    <div class="text-xs uppercase tracking-wider mb-1">Último acceso</div>
                    <div class="font-medium text-heading">{formatDate(props.profile.lastLogin)}</div>
                </div>
            </div>
        </div>
    );
};
