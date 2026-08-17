import type { Component } from 'solid-js';
import { BaseIcon, type IconProps } from './BaseIcon';

export const CopyIcon: Component<IconProps> = (props) => (
    <BaseIcon {...props}>
        <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </BaseIcon>
);

export default CopyIcon;
