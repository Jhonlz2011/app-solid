import { Component } from 'solid-js';
import { ProductClass, productClassLabels } from '../models/products.type';

interface ProductClassBadgeProps {
    productClass: ProductClass;
}

export const ProductClassBadge: Component<ProductClassBadgeProps> = (props) => {
    // Using inline styles with CSS variables for theme-aware colors
    const colorStyles: Record<ProductClass, { bg: string; text: string; border: string }> = {
        MATERIAL: { bg: 'var(--color-info-bg)', text: 'var(--color-info-text)', border: 'var(--color-info-border)' },
        TOOL: { bg: 'var(--color-warning-bg)', text: 'var(--color-warning-text)', border: 'var(--color-warning-border)' },
        EPP: { bg: 'var(--color-success-bg)', text: 'var(--color-success-text)', border: 'var(--color-success-border)' },
        ASSET: { bg: 'var(--color-primary-soft)', text: 'var(--color-primary)', border: 'rgba(var(--color-primary), 0.3)' },
        SERVICE: { bg: 'var(--color-warning-bg)', text: 'var(--color-warning-text)', border: 'var(--color-warning-border)' },
        MANUFACTURED: { bg: 'var(--color-danger-bg)', text: 'var(--color-danger-text)', border: 'var(--color-danger-border)' },
    };

    const style = colorStyles[props.productClass];
    return (
        <span
            class="px-2 py-0.5 text-xs font-medium rounded-full border"
            style={{ background: style.bg, color: style.text, 'border-color': style.border }}
        >
            {productClassLabels[props.productClass]}
        </span>
    );
};
