import { Component, JSX, splitProps, Show } from 'solid-js';
import { cn } from '../lib/utils';
export type BadgeVariant = 'success' | 'warning' | 'danger' | 'info' | 'default' | 'primary' | 'secondary' | 'purple' | 'pink' | 'orange' | 'teal' | 'cyan' | 'indigo';

interface BadgeProps {
    variant?: BadgeVariant;
    children: JSX.Element | string;
    onClick?: () => void;
    class?: string;
}

const variantStyles: Record<BadgeVariant, string> = {
    success: 'bg-success/15 text-success border-success/30',
    warning: 'bg-warning/15 text-warning border-warning/30',
    danger: 'bg-danger/15 text-danger border-danger/30',
    info: 'bg-info/15 text-info border-info/30',
    primary: 'bg-primary/15 text-primary border-primary/30',
    secondary: 'bg-secondary/15 text-secondary border-secondary/30',
    purple: 'bg-purple-500/15 text-purple-600 dark:text-purple-400 border-purple-500/30',
    pink: 'bg-pink-500/15 text-pink-600 dark:text-pink-400 border-pink-500/30',
    orange: 'bg-orange-500/15 text-orange-600 dark:text-orange-400 border-orange-500/30',
    teal: 'bg-teal-500/15 text-teal-600 dark:text-teal-400 border-teal-500/30',
    cyan: 'bg-cyan-500/15 text-cyan-600 dark:text-cyan-400 border-cyan-500/30',
    indigo: 'bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 border-indigo-500/30',
    default: 'bg-surface text-muted border-border',
};

export const Badge: Component<BadgeProps> = (props) => {
    const [local, rest] = splitProps(props, ['variant', 'children', 'onClick', 'class']);
    const styleClass = () => variantStyles[local.variant ?? 'default'];

    return (
        <span
            class={cn(
                "px-2 py-0.5 text-xs font-medium rounded-full border inline-flex items-center gap-1",
                styleClass(),
                local.onClick && "cursor-pointer hover:opacity-80 transition-opacity",
                local.class
            )}
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

export type CounterVariant = 'primary' | 'secondary' | 'danger' | 'success' | 'warning' | 'default' | 'purple' | 'pink' | 'orange' | 'teal' | 'cyan' | 'indigo' | 'tab' | 'tab-pill';


const counterVariants: Record<CounterVariant, string> = {
    primary: "bg-primary/15 text-primary",
    secondary: "bg-secondary/15 text-secondary",
    danger: "bg-danger/15 text-danger",
    success: "bg-success/15 text-success",
    warning: "bg-warning/15 text-warning",
    purple: "bg-purple-500/15 text-purple-600 dark:text-purple-400",
    pink: "bg-pink-500/15 text-pink-600 dark:text-pink-400",
    orange: "bg-orange-500/15 text-orange-600 dark:text-orange-400",
    teal: "bg-teal-500/15 text-teal-600 dark:text-teal-400",
    cyan: "bg-cyan-500/15 text-cyan-600 dark:text-cyan-400",
    indigo: "bg-indigo-500/15 text-indigo-600 dark:text-indigo-400",
    default: "bg-muted/15 text-muted",
    tab: "bg-surface/50 text-muted border border-border/50 group-hover:bg-primary/10 group-hover:text-text/80 group-data-[selected]:bg-primary/15 group-data-[selected]:text-text transition-colors",
    "tab-pill": "bg-surface/50 text-muted border border-border group-hover:bg-card-alt group-hover:border-border-strong group-hover:text-heading group-data-[selected]:bg-white/60 dark:group-data-[selected]:bg-black/20 group-data-[selected]:border-transparent group-data-[selected]:text-primary-strong transition-colors",
};

export const CounterBadge: Component<CounterBadgeProps> = (props) => {
    return (
        <Show when={props.count !== undefined}>
            <span class={cn(
                // Clases base que comparten todos los contadores
                "px-1.5 py-0.5 text-xs font-semibold rounded-full", 
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
            case 'create': case 'add': return 'success';
            case 'update': case 'edit': return 'warning';
            case 'delete': return 'danger';
            case 'restore': return 'primary';
            case 'destroy': return 'danger';
            case 'export': return 'info';
            case 'import': return 'success';
            case 'approve': return 'warning';
            case 'assign': return 'primary';
            case 'audit': return 'default';
            default: return 'default';
        }
    };

    return <Badge variant={variant()}>{props.action}</Badge>;
};

export default Badge;
