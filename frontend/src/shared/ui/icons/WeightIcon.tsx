import type { Component } from 'solid-js';
import { BaseIcon, type IconProps } from './BaseIcon';

export const WeightIcon: Component<IconProps> = (props) => (
    <BaseIcon {...props}>
        <circle cx="12" cy="5" r="3" />
        <path d="M6.5 8a2 2 0 0 0-2 1.5l-2.4 9A2 2 0 0 0 4 21h16a2 2 0 0 0 2-2.5l-2.6-9a2 2 0 0 0-2-1.5Z" />
    </BaseIcon>
);

export default WeightIcon;
