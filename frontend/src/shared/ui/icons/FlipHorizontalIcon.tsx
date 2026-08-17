import type { Component } from 'solid-js';
import { BaseIcon, type IconProps } from './BaseIcon';

export const FlipHorizontalIcon: Component<IconProps> = (props) => (
    <BaseIcon {...props}>
        <path d="M8 3H5a2 2 0 0 0-2 2v14q.2 1.8 2 2h3M16 3h3a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-3M12 20v2M12 14v2M12 8v2M12 2v2" />
    </BaseIcon>
);

export default FlipHorizontalIcon;
