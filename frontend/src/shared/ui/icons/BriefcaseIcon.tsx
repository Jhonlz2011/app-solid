import type { Component } from 'solid-js';
import { BaseIcon, type IconProps } from './BaseIcon';

export const BriefcaseIcon: Component<IconProps> = (props) => (
    <BaseIcon {...props}>
        <rect x="2" y="7" width="20" height="14" rx="3" ry="3" />
        <path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
        <line x1="2" y1="13" x2="22" y2="13" />
        <rect x="10" y="11" width="4" height="5" rx="1" />
    </BaseIcon>
);

export default BriefcaseIcon;
