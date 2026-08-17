import type { Component } from 'solid-js';
import { BaseIcon, type IconProps } from './BaseIcon';

export const ChevronsLeftIcon: Component<IconProps> = (props) => (
    <BaseIcon {...props}>
        <path d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
    </BaseIcon>
);

export default ChevronsLeftIcon;
