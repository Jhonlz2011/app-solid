import { Component, JSX, Show, mergeProps } from 'solid-js';
import { cn } from '../../lib/utils';
import { CheckIcon } from '@icons/CheckIcon';
import { Badge, type BadgeVariant } from '@display/Badge';

export type CardOptionVariant = 'primary' | 'secondary' | 'danger' | 'destructive' | 'warning' | 'success' | 'info' | 'neutral';
export type CardOptionSize = 'sm' | 'md' | 'lg';
export type CardOptionLayout = 'horizontal' | 'vertical';
export type CardOptionIndicator = 'none' | 'radio' | 'check' | 'dot';
export type CardOptionBadgePlacement = 'inline' | 'corner';

export interface CardOptionProps {
    value?: string;
    isSelected: boolean;
    onSelect: () => void;
    title: JSX.Element | string;
    description?: JSX.Element | string;
    icon?: JSX.Element;
    badge?: JSX.Element | string;
    badgeVariant?: BadgeVariant;
    badgePlacement?: CardOptionBadgePlacement;
    indicator?: CardOptionIndicator;
    variant?: CardOptionVariant;
    size?: CardOptionSize;
    layout?: CardOptionLayout;
    action?: JSX.Element;
    disabled?: boolean;
    class?: string;
    children?: JSX.Element;
}

const VARIANT_MAP: Record<CardOptionVariant, {
    selected: string;
    iconBg: string;
    radioBorder: string;
    radioDot: string;
    dot: string;
    title: string;
}> = {
    primary: {
        selected: 'border-primary bg-primary/8 shadow-xs',
        iconBg: 'bg-primary/15 text-primary',
        radioBorder: 'border-primary',
        radioDot: 'bg-primary',
        dot: 'bg-primary',
        title: 'text-heading',
    },
    secondary: {
        selected: 'border-secondary/60 bg-secondary/8 shadow-xs',
        iconBg: 'bg-secondary/15 text-secondary',
        radioBorder: 'border-secondary',
        radioDot: 'bg-secondary',
        dot: 'bg-secondary',
        title: 'text-text',
    },
    danger: {
        selected: 'border-danger/60 bg-danger/5 shadow-xs',
        iconBg: 'bg-danger/10 text-danger',
        radioBorder: 'border-danger',
        radioDot: 'bg-danger',
        dot: 'bg-danger',
        title: 'text-text',
    },
    destructive: {
        selected: 'border-destructive bg-destructive/5 shadow-xs',
        iconBg: 'bg-destructive/10 text-destructive',
        radioBorder: 'border-destructive',
        radioDot: 'bg-destructive',
        dot: 'bg-destructive',
        title: 'text-text',
    },
    warning: {
        selected: 'border-warning/60 bg-warning/8 shadow-xs',
        iconBg: 'bg-warning/15 text-warning',
        radioBorder: 'border-warning',
        radioDot: 'bg-warning',
        dot: 'bg-warning',
        title: 'text-text',
    },
    success: {
        selected: 'border-success/60 bg-success/8 shadow-xs',
        iconBg: 'bg-success/15 text-success',
        radioBorder: 'border-success',
        radioDot: 'bg-success',
        dot: 'bg-success',
        title: 'text-text',
    },
    info: {
        selected: 'border-info/60 bg-info/8 shadow-xs',
        iconBg: 'bg-info/15 text-info',
        radioBorder: 'border-info',
        radioDot: 'bg-info',
        dot: 'bg-info',
        title: 'text-text',
    },
    neutral: {
        selected: 'border-border-strong bg-surface shadow-xs',
        iconBg: 'bg-surface-3 text-heading',
        radioBorder: 'border-heading',
        radioDot: 'bg-heading',
        dot: 'bg-heading',
        title: 'text-text',
    },
};

const SIZE_MAP: Record<CardOptionSize, {
    containerHorizontal: string;
    containerVertical: string;
    iconBox: string;
    title: string;
    description: string;
    badge: string;
}> = {
    sm: {
        containerHorizontal: 'p-2.5 sm:p-3 gap-2.5',
        containerVertical: 'p-3 flex flex-col items-center text-center gap-2',
        iconBox: 'size-7.5 rounded-md text-sm',
        title: 'text-xs font-semibold leading-snug',
        description: 'text-[11px] leading-snug mt-0.5',
        badge: 'text-[9px] px-1.5 py-0',
    },
    md: {
        containerHorizontal: 'p-3 sm:p-3.5 gap-3',
        containerVertical: 'p-4 flex flex-col items-center text-center gap-3',
        iconBox: 'size-8.5 rounded-lg text-base',
        title: 'text-xs sm:text-sm font-semibold leading-snug',
        description: 'text-xs leading-relaxed mt-0.5',
        badge: 'text-[10px] px-1.5 py-0.5',
    },
    lg: {
        containerHorizontal: 'p-4 sm:p-5 gap-3.5',
        containerVertical: 'p-5 flex flex-col items-center text-center gap-4',
        iconBox: 'size-10 rounded-xl text-lg',
        title: 'text-sm sm:text-base font-semibold leading-snug',
        description: 'text-xs sm:text-sm leading-relaxed mt-1',
        badge: 'text-xs px-2 py-0.5',
    },
};

export const CardOption: Component<CardOptionProps> = (rawProps) => {
    const props = mergeProps(
        {
            indicator: 'none' as CardOptionIndicator,
            variant: 'primary' as CardOptionVariant,
            size: 'md' as CardOptionSize,
            layout: 'horizontal' as CardOptionLayout,
            badgeVariant: 'primary' as BadgeVariant,
            badgePlacement: 'inline' as CardOptionBadgePlacement,
            disabled: false,
        },
        rawProps
    );

    const variantStyles = () => VARIANT_MAP[props.variant] ?? VARIANT_MAP.primary;
    const sizeStyles = () => SIZE_MAP[props.size] ?? SIZE_MAP.md;

    const renderBadge = () => {
        if (!props.badge) return null;
        if (typeof props.badge === 'string' || typeof props.badge === 'number') {
            return (
                <Badge variant={props.badgeVariant} class={sizeStyles().badge}>
                    {props.badge}
                </Badge>
            );
        }
        return props.badge;
    };

    return (
        <button
            type="button"
            role="radio"
            aria-checked={props.isSelected}
            disabled={props.disabled}
            onClick={() => !props.disabled && props.onSelect()}
            class={cn(
                'relative rounded-xl border text-left cursor-pointer transition-all duration-150 select-none outline-hidden',
                'focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-1 focus-visible:ring-offset-bg',
                props.disabled && 'opacity-50 cursor-not-allowed pointer-events-none',
                props.isSelected
                    ? variantStyles().selected
                    : 'border-border/60 bg-surface/40 hover:bg-surface hover:border-border',
                props.layout === 'vertical'
                    ? sizeStyles().containerVertical
                    : cn('flex items-start', sizeStyles().containerHorizontal),
                props.class
            )}
        >
            {/* ── Radio indicator (Left positioned if horizontal layout with radio indicator) ── */}
            <Show when={props.layout === 'horizontal' && props.indicator === 'radio'}>
                <div
                    class={cn(
                        'mt-0.5 size-4 rounded-full border-2 shrink-0 flex items-center justify-center transition-colors duration-150',
                        props.isSelected ? variantStyles().radioBorder : 'border-muted/60'
                    )}
                >
                    <Show when={props.isSelected}>
                        <div class={cn('size-2 rounded-full animate-in zoom-in-50 duration-100', variantStyles().radioDot)} />
                    </Show>
                </div>
            </Show>

            {/* ── Optional Icon ── */}
            <Show when={props.icon}>
                <div
                    class={cn(
                        'flex items-center justify-center shrink-0 transition-colors duration-150',
                        sizeStyles().iconBox,
                        props.isSelected ? variantStyles().iconBg : 'bg-surface text-muted'
                    )}
                >
                    {props.icon}
                </div>
            </Show>

            {/* ── Content (Title & Description) ── */}
            <div class={cn('min-w-0 flex-1', props.layout === 'vertical' && 'w-full')}>
                <div class={cn(
                    'flex items-center gap-2',
                    props.layout === 'vertical' ? 'justify-center' : 'justify-between'
                )}>
                    {/* Title + Inline Badge flow */}
                    <div class={cn(
                        'flex items-center gap-1.5 flex-wrap min-w-0',
                        props.layout === 'vertical' && 'justify-center'
                    )}>
                        <span class={cn(sizeStyles().title, variantStyles().title)}>
                            {props.title}
                        </span>

                        <Show when={props.badge && (props.badgePlacement === 'inline' || props.layout === 'horizontal')}>
                            <div class="shrink-0">
                                {renderBadge()}
                            </div>
                        </Show>
                    </div>

                    {/* Action Slot (e.g. Warning popover / Spinner) */}
                    <Show when={props.action}>
                        <div class="shrink-0 flex items-center gap-1">
                            {props.action}
                        </div>
                    </Show>
                </div>

                <Show when={props.description}>
                    <p class={cn('text-muted', sizeStyles().description)}>
                        {props.description}
                    </p>
                </Show>

                {props.children}
            </div>

            {/* ── Badge (Corner placement for vertical layout) ── */}
            <Show when={props.badge && props.badgePlacement === 'corner' && props.layout === 'vertical'}>
                <div class="absolute top-2.5 right-2.5">
                    {renderBadge()}
                </div>
            </Show>

            {/* ── Check indicator (Top right) ── */}
            <Show when={props.indicator === 'check' && props.isSelected}>
                <div class="size-4.5 rounded-full bg-primary text-on-primary flex items-center justify-center shrink-0 animate-in zoom-in-50 duration-100">
                    <CheckIcon class="size-3 stroke-3" />
                </div>
            </Show>

            {/* ── Dot indicator (Top right) ── */}
            <Show when={props.indicator === 'dot' && props.isSelected}>
                <div class={cn('absolute top-2.5 right-2.5 size-2 rounded-full animate-in zoom-in-50 duration-100', variantStyles().dot)} />
            </Show>
        </button>
    );
};

export default CardOption;
