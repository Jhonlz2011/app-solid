import type { Component } from 'solid-js';
import { BaseIcon, type IconProps } from './BaseIcon';

export const UserIcon: Component<IconProps> = (props) => (
    <BaseIcon class="size-4" {...props}>
        <path d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
    </BaseIcon>
);

export default UserIcon;
