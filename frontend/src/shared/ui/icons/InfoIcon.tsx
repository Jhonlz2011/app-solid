import type { Component } from 'solid-js';
import { BaseIcon, type IconProps } from './BaseIcon';

export const InfoIcon: Component<IconProps> = (props) => (
    <BaseIcon {...props}>
        <path d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </BaseIcon>
);