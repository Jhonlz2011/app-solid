import type { Component } from 'solid-js';
import { BaseIcon, type IconProps } from './BaseIcon';

export const ChevronRightIcon: Component<IconProps> = (props) => (
    <BaseIcon {...props}>
        <path d="M9 5l7 7-7 7" />
    </BaseIcon>
);

export default ChevronRightIcon;
