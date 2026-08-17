import { splitProps, type JSX, type Component } from 'solid-js';

export interface IconProps extends JSX.SvgSVGAttributes<SVGSVGElement> {
    class?: string;
    strokeWidth?: number;
}

export const BaseIcon: Component<IconProps & { children?: JSX.Element }> = (props) => {
    const [local, others] = splitProps(props, ['class', 'children', 'strokeWidth']);
    return (
        <svg
            xmlns="http://www.w3.org/2000/svg"
            class={local.class ?? 'size-5'}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            stroke-width={local.strokeWidth ?? 2}
            stroke-linecap="round"
            stroke-linejoin="round"
            {...others}
        >
            {local.children}
        </svg>
    );
};
