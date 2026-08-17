import type { Component } from 'solid-js';
import { BaseIcon, type IconProps } from './BaseIcon';

export const SearchXIcon: Component<IconProps> = (props) => (
    <BaseIcon {...props}>
        <path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        <path d="M7.5 7.5l5 5M12.5 7.5l-5 5" />
    </BaseIcon>
);

export default SearchXIcon;
