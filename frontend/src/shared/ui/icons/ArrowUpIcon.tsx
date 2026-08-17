import type { Component } from 'solid-js';
import { BaseIcon, type IconProps } from './BaseIcon';

export const ArrowUpIcon: Component<IconProps> = (props) => (
    <BaseIcon {...props}>
        <path d="M5 15l7-7 7 7" />
    </BaseIcon>
);
