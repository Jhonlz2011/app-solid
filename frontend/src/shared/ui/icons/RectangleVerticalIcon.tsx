import type { Component } from 'solid-js';
import { BaseIcon, type IconProps } from './BaseIcon';

export const RectangleVerticalIcon: Component<IconProps> = (props) => (
    <BaseIcon {...props}>
        <rect width="12" height="20" x="6" y="2" rx="2" />
    </BaseIcon>
);

export default RectangleVerticalIcon;
