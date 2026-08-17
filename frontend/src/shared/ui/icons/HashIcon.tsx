import type { Component } from 'solid-js';
import { BaseIcon, type IconProps } from './BaseIcon';

export const HashIcon: Component<IconProps> = (props) => (
    <BaseIcon {...props}>
        <line x1="4" x2="20" y1="9" y2="9" />
        <line x1="4" x2="20" y1="15" y2="15" />
        <line x1="10" x2="8" y1="3" y2="21" />
        <line x1="16" x2="14" y1="3" y2="21" />
    </BaseIcon>
);

export default HashIcon;
