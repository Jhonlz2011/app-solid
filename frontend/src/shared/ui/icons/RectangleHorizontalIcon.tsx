import type { Component } from 'solid-js';
import { BaseIcon, type IconProps } from './BaseIcon';

export const RectangleHorizontalIcon: Component<IconProps> = (props) => (
    <BaseIcon {...props}>
        <rect width="20" height="12" x="2" y="6" rx="2" />
    </BaseIcon>
);

export default RectangleHorizontalIcon;
