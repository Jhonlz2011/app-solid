import type { Component } from 'solid-js';
import { BaseIcon, type IconProps } from './BaseIcon';

export const ShelvesIcon: Component<IconProps> = (props) => (
    <BaseIcon {...props}>
        <path d="M4 2v20-2h16v2V2v2H4zm0 2h16v8h-8V9q0-1-1-1H9a1 1 0 0 0-1 1v3H4zm5 4h2q.9.1 1 1v3H8V9q.1-.9 1-1m-5 4h16v8h-4v-3q0-1-1-1h-2a1 1 0 0 0-1 1v3H4zm9 4h2q.9.1 1 1v3h-4v-3q.1-.9 1-1" />
    </BaseIcon>
);

export default ShelvesIcon;
