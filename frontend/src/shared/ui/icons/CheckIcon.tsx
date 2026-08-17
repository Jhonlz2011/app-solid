import type { Component } from 'solid-js';
import { BaseIcon, type IconProps } from './BaseIcon';

export const CheckIcon: Component<IconProps> = (props) => (
    <BaseIcon {...props}>
        <path d="M5 13l4 4L19 7" />
    </BaseIcon>
);

export default CheckIcon;
