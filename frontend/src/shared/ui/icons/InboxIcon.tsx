import type { Component } from 'solid-js';
import { BaseIcon, type IconProps } from './BaseIcon';

export const InboxIcon: Component<IconProps> = (props) => (
    <BaseIcon {...props}>
        <path d="M7.2 4a2 2 0 0 0-1.8 1L2 12v6q.2 1.8 2 2h16q1.8-.2 2-2v-6l-3.4-7a2 2 0 0 0-1.8-1zm0 0h9.6a2 2 0 0 1 1.7 1.1L22 12H16l-2 3h-4l-2-3H2l3.5-6.8q.5-1 1.7-1m-5.1 8H8l2 3h4l2-3h6v6c0 1-1 2-2 2H4c-1 0-2-1-2-2z" />
    </BaseIcon>
);

export default InboxIcon;
