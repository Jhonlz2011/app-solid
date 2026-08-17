import type { Component } from 'solid-js';
import { BaseIcon, type IconProps } from './BaseIcon';

export const RotateCwIcon: Component<IconProps> = (props) => (
    <BaseIcon {...props}>
        <path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8" />
        <polyline points="21 3 21 8 16 8" />
    </BaseIcon>
);