import type { Component } from 'solid-js';
import { BaseIcon, type IconProps } from './BaseIcon';

export const SquareIcon: Component<IconProps> = (props) => (
    <BaseIcon {...props}>
        <rect width="18" height="18" x="3" y="3" rx="2" />
    </BaseIcon>
);

export default SquareIcon;
