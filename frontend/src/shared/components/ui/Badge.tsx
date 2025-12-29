import { Component, JSX, splitProps } from 'solid-js';

export type BadgeVariant = 'success' | 'warning' | 'danger' | 'info' | 'default' | 'primary';

interface BadgeProps {
    variant?: BadgeVariant;
    children: JSX.Element | string;
    onClick?: () => void;
    class?: string;
}

const variantStyles: Record<BadgeVariant, { bg: string; text: string; border: string }> = {
    success: { bg: 'var(--color-success-bg)', text: 'var(--color-success-text)', border: 'var(--color-success-border)' },
    warning: { bg: 'var(--color-warning-bg)', text: 'var(--color-warning-text)', border: 'var(--color-warning-border)' },
    danger: { bg: 'var(--color-danger-bg)', text: 'var(--color-danger-text)', border: 'var(--color-danger-border)' },
    info: { bg: 'var(--color-info-bg)', text: 'var(--color-info-text)', border: 'var(--color-info-border)' },
    primary: { bg: 'var(--color-primary-soft)', text: 'var(--color-primary)', border: 'rgba(var(--color-primary-rgb), 0.3)' },
    default: { bg: 'var(--color-surface)', text: 'var(--color-text-muted)', border: 'var(--color-border)' },
};

export const Badge: Component<BadgeProps> = (props) => {
    const [local, rest] = splitProps(props, ['variant', 'children', 'onClick', 'class']);
    const style = () => variantStyles[local.variant ?? 'default'];

    return (
        <span
            class={`px-2 py-0.5 text-xs font-medium rounded-full border inline-flex items-center gap-1 ${local.onClick ? 'cursor-pointer hover:opacity-80 transition-opacity' : ''} ${local.class ?? ''}`}
            style={{ background: style().bg, color: style().text, 'border-color': style().border }}
            onClick={(e) => { if (local.onClick) { e.stopPropagation(); local.onClick(); } }}
            {...rest}
        >
            {local.children}
        </span>
    );
};

// Pre-configured role badge
export const RoleBadge: Component<{ name: string; onClick?: () => void }> = (props) => {
    const variant = (): BadgeVariant => {
        switch (props.name) {
            case 'superadmin': return 'danger';
            case 'admin': return 'warning';
            default: return 'info';
        }
    };

    return <Badge variant={variant()} onClick={props.onClick}>{props.name}</Badge>;
};

// Pre-configured status badge
export const StatusBadge: Component<{ isActive: boolean | null }> = (props) => (
    <Badge variant={props.isActive ? 'success' : 'danger'}>
        {props.isActive ? 'Activo' : 'Inactivo'}
    </Badge>
);

// Pre-configured action badge (read, add, edit, delete)
export const ActionBadge: Component<{ action: string }> = (props) => {
    const variant = (): BadgeVariant => {
        switch (props.action) {
            case 'read': return 'info';
            case 'add': return 'success';
            case 'edit': return 'warning';
            case 'delete': return 'danger';
            default: return 'default';
        }
    };

    return <Badge variant={variant()}>{props.action}</Badge>;
};

export default Badge;
