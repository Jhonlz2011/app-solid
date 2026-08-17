import type { Component } from 'solid-js';
import { BaseIcon, type IconProps } from './BaseIcon';

export const ChevronsRightIcon: Component<IconProps> = (props) => (
    <BaseIcon {...props}>
        <path d="M13 5l7 7-7 7M5 5l7 7-7 7" />
    </BaseIcon>
);

export default ChevronsRightIcon;
