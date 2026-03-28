import { Component, JSX, splitProps, Show } from 'solid-js';
import { cn } from '../lib/utils';

export type BadgeVariant = 'success' | 'warning' | 'danger' | 'info' | 'default' | 'primary' | 'secondary' | 'purple' | 'pink' | 'orange' | 'teal' | 'cyan' | 'indigo';

// 1. OPTIMIZACIÓN: Extender atributos HTML nativos para mayor flexibilidad
interface BadgeProps extends JSX.HTMLAttributes<HTMLSpanElement> {
    variant?: BadgeVariant;
    children: JSX.Element | string;
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

    // 2. OPTIMIZACIÓN: Manejador de eventos más limpio
    const handleClick: JSX.EventHandlerUnion<HTMLSpanElement, MouseEvent> = (e) => {
        if (local.onClick) {
            e.stopPropagation();
            if (typeof local.onClick === 'function') local.onClick(e);
        }
    };

    return (
        <span
            class={cn(
                "px-2 py-0.5 text-xs font-medium rounded-full border inline-flex items-center gap-1",
                variantStyles[local.variant ?? 'default'], // Reactivo automáticamente dentro del JSX
                local.onClick && "cursor-pointer hover:opacity-80 transition-opacity",
                local.class
            )}
            onClick={local.onClick ? handleClick : undefined}
            {...rest}
        >
            {local.children}
        </span>
    );
};

// ── Counter Badge ──
export type CounterVariant = 'primary' | 'secondary' | 'danger' | 'success' | 'warning' | 'default' | 'purple' | 'pink' | 'orange' | 'teal' | 'cyan' | 'indigo' | 'tab' | 'tab-pill';

interface CounterBadgeProps extends JSX.HTMLAttributes<HTMLSpanElement> {
    count?: number;
    variant?: CounterVariant;
    class?: string;
}

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
    const [local, rest] = splitProps(props, ['count', 'variant', 'class']);
    
    return (
        <Show when={local.count !== undefined}>
            <span 
                class={cn(
                    "px-1.5 py-0.5 text-xs font-semibold rounded-full", 
                    counterVariants[local.variant ?? 'default'],
                    local.class
                )}
                {...rest}
            >
                {local.count?.toLocaleString()}
            </span>
        </Show>
    );
};

// ── Role & Status Badges ──
const roleVariants: Record<string, BadgeVariant> = {
    superadmin: 'danger',
    admin: 'warning',
};

export const RoleBadge: Component<{ name: string; onClick?: () => void }> = (props) => (
    <Badge variant={roleVariants[props.name] || 'info'} onClick={props.onClick}>
        {props.name}
    </Badge>
);

export const StatusBadge: Component<{ isActive: boolean | null }> = (props) => (
    <Badge variant={props.isActive ? 'success' : 'danger'}>
        {props.isActive ? 'Activo' : 'Inactivo'}
    </Badge>
);

// ── Action Badge ──
const ACTION_LABELS: Record<string, string> = {
    read: 'Ver', create: 'Crear', add: 'Agregar', update: 'Editar',
    edit: 'Editar', delete: 'Eliminar', restore: 'Restaurar',
    destroy: 'Destruir', export: 'Exportar', import: 'Importar',
    approve: 'Aprobar', assign: 'Asignar', audit: 'Auditar',
};

// 3. OPTIMIZACIÓN: Se reemplazó el Switch por un diccionario constante
const ACTION_VARIANTS: Record<string, BadgeVariant> = {
    read: 'info', create: 'success', add: 'success',
    update: 'warning', edit: 'warning', approve: 'warning',
    delete: 'danger', destroy: 'danger', restore: 'primary',
    assign: 'primary', export: 'info', import: 'success',
};

export const ActionBadge: Component<{ action: string }> = (props) => {
    const variant = () => ACTION_VARIANTS[props.action] ?? 'default';
    const label = () => ACTION_LABELS[props.action] ?? (props.action.charAt(0).toUpperCase() + props.action.slice(1));

    return <Badge variant={variant()}>{label()}</Badge>;
};

// ── Entity Type Badge ──
export type EntityType = 'employee' | 'client' | 'supplier' | 'carrier';

const ENTITY_TYPE_CONFIG: Record<EntityType, { label: string; colors: string }> = {
    employee: { label: 'Empleado', colors: 'bg-primary/10 text-primary' },
    client: { label: 'Cliente', colors: 'bg-emerald-500/10 text-emerald-600' },
    supplier: { label: 'Proveedor', colors: 'bg-amber-500/10 text-amber-600' },
    carrier: { label: 'Transportista', colors: 'bg-sky-500/10 text-sky-600' },
};

export const EntityTypeBadge: Component<{ type: EntityType; class?: string }> = (props) => {
    const cfg = () => ENTITY_TYPE_CONFIG[props.type];
    return (
        <span class={cn('text-[10px] px-1.5 py-0.5 rounded font-medium', cfg().colors, props.class)}>
            {cfg().label}
        </span>
    );
};

export default Badge;