import type { Component } from 'solid-js';
import { BaseIcon, type IconProps } from './BaseIcon';

export const MoreVerticalIcon: Component<IconProps> = (props) => (
    <BaseIcon {...props}>
        <circle cx="12" cy="12" r="1" />
        <circle cx="12" cy="5" r="1" />
        <circle cx="12" cy="19" r="1" />
    </BaseIcon>
);

export default MoreVerticalIcon;
