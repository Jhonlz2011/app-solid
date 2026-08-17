import type { Component } from 'solid-js';
import { BaseIcon, type IconProps } from './BaseIcon';

export const AlertCircleIcon: Component<IconProps> = (props) => (
    <BaseIcon {...props}>
        <path d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </BaseIcon>
);

export default AlertCircleIcon;
