import type { Component } from 'solid-js';
import { BaseIcon, type IconProps } from './BaseIcon';

export const ProductIcon: Component<IconProps> = (props) => (
    <BaseIcon {...props}>
        <path d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
    </BaseIcon>
);

export default ProductIcon;
