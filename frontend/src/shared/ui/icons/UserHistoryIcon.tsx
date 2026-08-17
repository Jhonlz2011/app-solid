import type { Component } from 'solid-js';
import { BaseIcon, type IconProps } from './BaseIcon';

export const UserHistoryIcon: Component<IconProps> = (props) => (
    <BaseIcon {...props}>
        {/* Cabeza del usuario, Cuerpo recortado, Reloj, Manecillas */}
        <path d="M13 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0z M2 21v-2a4 4 0 0 1 4-4h3.5 M22 16a5 5 0 1 1-10 0 5 5 0 0 1 10 0z M17 13.5v2.5l1.5 1.5" />
    </BaseIcon>
);

export default UserHistoryIcon;
