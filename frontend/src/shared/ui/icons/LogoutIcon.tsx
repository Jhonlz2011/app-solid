import type { Component } from 'solid-js';
import { BaseIcon, type IconProps } from './BaseIcon';

export const LogoutIcon: Component<IconProps> = (props) => (
    <BaseIcon {...props}>
        <path d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
    </BaseIcon>
);

export default LogoutIcon;
