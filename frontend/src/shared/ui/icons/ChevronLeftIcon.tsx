import type { Component } from 'solid-js';
import { BaseIcon, type IconProps } from './BaseIcon';

export const ChevronLeftIcon: Component<IconProps> = (props) => (
    <BaseIcon {...props}>
        <path d="M15 19l-7-7 7-7" />
    </BaseIcon>
);

export default ChevronLeftIcon;
