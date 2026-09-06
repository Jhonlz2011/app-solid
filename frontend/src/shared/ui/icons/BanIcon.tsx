import type { Component } from 'solid-js';
import { BaseIcon, type IconProps } from './BaseIcon';

export const BanIcon: Component<IconProps> = (props) => (
    <BaseIcon {...props}>
        <circle cx="12" cy="12" r="10" />
        <path d="M8 12h8" />
    </BaseIcon>
);

export default BanIcon;
