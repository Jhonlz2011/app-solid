import { Component, JSX, splitProps, Show } from 'solid-js';
import { cn } from '../lib/utils';
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
            class={cn(
                "px-2 py-0.5 text-xs font-medium rounded-full border inline-flex items-center gap-1",
                local.onClick && "cursor-pointer hover:opacity-80 transition-opacity",
                local.class
            )}
            style={{ background: style().bg, color: style().text, 'border-color': style().border }}
            onClick={(e) => { 
                if (local.onClick) { 
                    e.stopPropagation(); 
                    local.onClick(); 
                } 
            }}
            {...rest}
        >
            {local.children}
        </span>
    );
};

// 2. NUEVO: Counter Badge Integrado
interface CounterBadgeProps {
    count?: number;
    variant?: CounterVariant;
    class?: string;
}

export type CounterVariant = 'primary' | 'danger' | 'success' | 'warning' | 'default';


const counterVariants: Record<CounterVariant, string> = {
    primary: "bg-primary/15 text-primary",
    danger: "bg-red-500/15 text-red-600 dark:text-red-400", // Ejemplo si usas colores base de Tailwind
    success: "bg-green-500/15 text-green-600 dark:text-green-400",
    warning: "bg-yellow-500/15 text-yellow-600 dark:text-yellow-400",
    default: "bg-gray-500/15 text-gray-600 dark:text-gray-400",
};

export const CounterBadge: Component<CounterBadgeProps> = (props) => {
    return (
        <Show when={props.count !== undefined}>
            <span class={cn(
                // Clases base que comparten todos los contadores
                "px-2.5 py-0.5 text-sm font-semibold rounded-full", 
                // Aplicamos la variante (por defecto será 'primary' si no se especifica)
                counterVariants[props.variant ?? 'default'],
                // Clases extra que le pases al componente
                props.class
            )}>
                {props.count?.toLocaleString()}
            </span>
        </Show>
    );
};


// 3. Diccionarios en lugar de Switch statements para mayor limpieza
const roleVariants: Record<string, BadgeVariant> = {
    superadmin: 'danger',
    admin: 'warning',
};
// Pre-configured role badge
export const RoleBadge: Component<{ name: string; onClick?: () => void }> = (props) => (
    <Badge
        variant={roleVariants[props.name] || 'info'}
        onClick={props.onClick}
    >
        {props.name}
    </Badge>
);

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
