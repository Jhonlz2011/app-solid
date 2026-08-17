import type { Component } from 'solid-js';
import { BaseIcon, type IconProps } from './BaseIcon';

export const ArrowRightIcon: Component<IconProps> = (props) => (
    <BaseIcon {...props}>
        <path d="M5 12h14" />
        <path d="m12 5 7 7-7 7" />
    </BaseIcon>
);

export default ArrowRightIcon;
