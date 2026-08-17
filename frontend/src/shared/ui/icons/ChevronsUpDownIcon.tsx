import type { Component } from 'solid-js';
import { BaseIcon, type IconProps } from './BaseIcon';

export const ChevronsUpDownIcon: Component<IconProps> = (props) => (
    <BaseIcon {...props}>
        <path d="m7 15 5 5 5-5" />
        <path d="m7 9 5-5 5 5" />
    </BaseIcon>
);

export default ChevronsUpDownIcon;
