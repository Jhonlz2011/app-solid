import type { Component } from 'solid-js';
import { BaseIcon, type IconProps } from './BaseIcon';

export const ClockIcon: Component<IconProps> = (props) => (
    <BaseIcon {...props}>
        <circle cx="12" cy="12" r="10" />
        <polyline points="12 6 12 12 16 14" />
    </BaseIcon>
);

export default ClockIcon;
