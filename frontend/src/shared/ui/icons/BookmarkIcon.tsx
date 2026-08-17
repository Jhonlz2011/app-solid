import type { Component } from 'solid-js';
import { BaseIcon, type IconProps } from './BaseIcon';

export const BookmarkIcon: Component<IconProps> = (props) => (
    <BaseIcon {...props}>
        <path d="M7 3a2 2 0 0 0-2 2v15a1 1 0 0 0 1.5.9l4.5-2.6a2 2 0 0 1 2 0l4.5 2.6A1 1 0 0 0 19 20V5a2 2 0 0 0-2-2zm0 0h10a2 2 0 0 1 2 2v15a1 1 0 0 1-1.5.9L13 18.3a2 2 0 0 0-2 0l-4.5 2.6A1 1 0 0 1 5 20V5q.2-1.8 2-2" />
    </BaseIcon>
);

export default BookmarkIcon;
