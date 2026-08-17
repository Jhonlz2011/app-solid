import type { Component } from 'solid-js';
import { BaseIcon, type IconProps } from './BaseIcon';

export const ThermometerIcon: Component<IconProps> = (props) => (
    <BaseIcon {...props}>
        <path d="M14 4v10.54a4 4 0 1 1-4 0V4a2 2 0 0 1 4 0Z" />
    </BaseIcon>
);

export default ThermometerIcon;
