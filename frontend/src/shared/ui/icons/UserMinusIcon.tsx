import type { Component } from 'solid-js';
import { BaseIcon, type IconProps } from './BaseIcon';

export const UserMinusIcon: Component<IconProps> = (props) => (
    <BaseIcon {...props}>
        <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <line x1="22" x2="16" y1="11" y2="11" />
    </BaseIcon>
);

export default UserMinusIcon;
