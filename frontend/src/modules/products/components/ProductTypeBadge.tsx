import { Component, Show } from 'solid-js';
import type { ProductClass } from '../models/products.types';
import { productTypeLabels } from '../models/products.types';

interface Props {
    type?: ProductClass;
}

export const ProductTypeBadge: Component<Props> = (props) => {
    return (
        <Show when={props.type}>
            <span
                class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border"
                classList={{
                    'bg-blue-50 text-blue-700 border-blue-200': props.type === 'PRODUCTO',
                    'bg-purple-50 text-purple-700 border-purple-200': props.type === 'SERVICIO',
                }}
            >
                {productTypeLabels[props.type!] || props.type}
            </span>
        </Show>
    );
};
