import type { Component } from 'solid-js';
import { BaseIcon, type IconProps } from './BaseIcon';

export const BeakerIcon: Component<IconProps> = (props) => (
    <BaseIcon {...props}>
        <path d="M21 7 6.8 21.2a3 3 0 0 1-4 0 3 3 0 0 1 0-4L17 3M16 2l6 6M12 16H4" />
    </BaseIcon>
);

export default BeakerIcon;
