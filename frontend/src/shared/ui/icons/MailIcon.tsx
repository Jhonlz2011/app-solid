import type { Component } from 'solid-js';
import { BaseIcon, type IconProps } from './BaseIcon';

export const MailIcon: Component<IconProps> = (props) => (
    <BaseIcon {...props}>
        <path d="m22 7-9 5.7a2 2 0 0 1-2 0L2 7" />
        <rect width="20" height="16" x="2" y="4" rx="2" />
    </BaseIcon>
);

export default MailIcon;
