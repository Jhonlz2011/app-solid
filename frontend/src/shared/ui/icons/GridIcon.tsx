import type { Component } from 'solid-js';
import { BaseIcon, type IconProps } from './BaseIcon';

export const GridIcon: Component<IconProps> = (props) => (
    <BaseIcon {...props}>
        <path d="m12 8 6-3-6-3v10M8 12 2.5 15a1 1 0 0 0 0 1.8l8.5 4.8a2 2 0 0 0 2 0l8.5-4.8a1 1 0 0 0 0-1.8L16 12M6.5 12.9l11 6.2M17.5 12.9 6.5 19" />
    </BaseIcon>
);

export default GridIcon;
