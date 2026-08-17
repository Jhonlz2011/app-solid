import type { Component } from 'solid-js';
import { BaseIcon, type IconProps } from './BaseIcon';

export const CollapseIcon: Component<IconProps> = (props) => (
    <BaseIcon {...props}>
        <path d="M12 22v-6M12 8V2M4 12H2M10 12H8M16 12h-2M22 12h-2M15 19l-3-3-3 3M15 5l-3 3-3-3" />
    </BaseIcon>
);

export const Collapse = CollapseIcon;
export default CollapseIcon;
