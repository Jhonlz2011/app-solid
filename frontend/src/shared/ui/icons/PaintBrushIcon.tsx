import type { Component } from 'solid-js';
import { BaseIcon, type IconProps } from './BaseIcon';

export const PaintBrushIcon: Component<IconProps> = (props) => (
    <BaseIcon {...props}>
        <path d="M14.6 17.9 4 14.9M18.4 2.6a1 1 0 1 1 3 3l-4 4a.5.5 0 0 0 0 .8l.9.9a2.4 2.4 0 0 1 0 3.4l-1 1h-.6L8.4 7.2a1 1 0 0 1 0-.7l.9-.9a2.4 2.4 0 0 1 3.4 0l1 1a1 1 0 0 0 .7 0zM9 8c-1.8 2.7-4 3.5-6.6 4a.5.5 0 0 0-.3.8l7.3 8.8a1 1 0 0 0 1.2.3c2.1-1.5 5.4-5.1 5.4-6.9" />
    </BaseIcon>
);

export default PaintBrushIcon;
