// Profile Header Component
import { Component } from 'solid-js';
import { getAvatarGradientStyle, getInitials } from '@shared/utils/avatar';
import type { Profile } from '../models/profile.types';

interface ProfileHeaderProps {
    profile: Profile;
}

export const ProfileHeader: Component<ProfileHeaderProps> = (props) => {
    const formatDate = (dateStr: string | null) => {
        if (!dateStr) return 'Nunca';
        const d = new Date(dateStr);
        return d.toLocaleDateString('es-EC', {
            day: 'numeric',
            month: 'long',
            year: 'numeric',
        });
    };

    const displayName = props.profile.entity?.businessName || props.profile.username || props.profile.email;

    return (
        <div class="mb-8">
            <div class="flex flex-col sm:flex-row items-center gap-5">
                {/* Large Avatar */}
                <div
                    class="size-20 sm:size-24 rounded-2xl flex items-center justify-center text-white font-bold text-2xl sm:text-3xl shadow-lg shrink-0"
                    style={getAvatarGradientStyle(displayName)}
                >
                    {getInitials(displayName)}
                </div>

                {/* User Info */}
                <div class="flex-1 text-center sm:text-left">
                    <h1 class="text-2xl sm:text-3xl font-bold text-heading mb-1">
                        {displayName}
                    </h1>
                    <p class="text-muted text-sm sm:text-base mb-3">
                        @{props.profile.username} · {props.profile.email}
                    </p>

                    {/* Badges */}
                    <div class="flex flex-wrap justify-center sm:justify-start gap-2">
                        {props.profile.roles?.map((role) => (
                            <span class="px-3 py-1 text-xs font-semibold rounded-full bg-primary/10 text-primary-strong border border-primary/20">
                                {role}
                            </span>
                        ))}
                        {props.profile.entity?.isEmployee && (
                            <span class="px-3 py-1 text-xs font-semibold rounded-full bg-success/10 text-success border border-success/20">
                                Empleado
                            </span>
                        )}
                        {props.profile.entity?.isClient && (
                            <span class="px-3 py-1 text-xs font-semibold rounded-full bg-info/10 text-info border border-info/20">
                                Cliente
                            </span>
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
