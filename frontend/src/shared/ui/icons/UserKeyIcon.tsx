import type { Component } from 'solid-js';
import { BaseIcon, type IconProps } from './BaseIcon';

export const UserKeyIcon: Component<IconProps> = (props) => (
    <BaseIcon {...props}>
        {/* User matching the exact style and thickness of UsersIcon */}
        <path d="M13 7a4 4 0 11-8 0 4 4 0 018 0z M15 21H3v-1a6 6 0 0112 0v1z" />
        {/* Key with consistent weight, solid stem and outline head (no inner circle overlapping stroke) */}
        <path d="M22 8a3 3 0 11-6 0 3 3 0 016 0z M19 11v10 M19 17h3 M19 21h3" />
    </BaseIcon>
);

export default UserKeyIcon;
