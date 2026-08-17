import type { Component } from 'solid-js';
import { BaseIcon, type IconProps } from './BaseIcon';

export const ChevronDownIcon: Component<IconProps> = (props) => (
    <BaseIcon {...props}>
        <path d="M19 9l-7 7-7-7" />
    </BaseIcon>
);

export default ChevronDownIcon;
