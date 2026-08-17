import type { Component } from 'solid-js';
import { BaseIcon, type IconProps } from './BaseIcon';

export const MinusIcon: Component<IconProps> = (props) => (
    <BaseIcon {...props}>
        <line x1="5" y1="12" x2="19" y2="12" />
    </BaseIcon>
);

export default MinusIcon;
