import type { Component } from 'solid-js';
import { BaseIcon, type IconProps } from './BaseIcon';

export const GripVerticalIcon: Component<IconProps> = (props) => (
    <BaseIcon {...props}>
        <circle cx="9" cy="12" r="1" /><circle cx="9" cy="5" r="1" /><circle cx="9" cy="19" r="1" />
        <circle cx="15" cy="12" r="1" /><circle cx="15" cy="5" r="1" /><circle cx="15" cy="19" r="1" />
    </BaseIcon>
);

export default GripVerticalIcon;
