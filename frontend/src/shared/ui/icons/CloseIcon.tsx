import type { Component } from 'solid-js';
import { BaseIcon, type IconProps } from './BaseIcon';

export const CloseIcon: Component<IconProps> = (props) => (
    <BaseIcon {...props}>
        <path d="M6 18L18 6M6 6l12 12" />
    </BaseIcon>
);

export default CloseIcon;
