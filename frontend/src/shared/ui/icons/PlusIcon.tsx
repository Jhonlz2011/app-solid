import type { Component } from 'solid-js';
import { BaseIcon, type IconProps } from './BaseIcon';

export const PlusIcon: Component<IconProps> = (props) => (
    <BaseIcon {...props}>
        <path d="M12 4v16m8-8H4" />
    </BaseIcon>
);

export default PlusIcon;
