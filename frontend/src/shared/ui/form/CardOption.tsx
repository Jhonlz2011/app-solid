import { Component, JSX, Show, mergeProps } from 'solid-js';
import { cn } from '../../lib/utils';
import { CheckIcon } from '@icons/CheckIcon';
import { Badge, type BadgeVariant } from '@display/Badge';

export type CardOptionVariant = 'primary' | 'secondary' | 'danger' | 'destructive' | 'warning' | 'success' | 'info' | 'neutral';

export interface CardOptionProps {
    value?: string;
    isSelected: boolean;
    onSelect: () => void;
    title: JSX.Element | string;
    description?: JSX.Element | string;
    icon?: JSX.Element;
    badge?: JSX.Element | string;
    badgeVariant?: BadgeVariant;
    indicator?: 'radio' | 'check' | 'dot' | 'none';
    variant?: CardOptionVariant;
    layout?: 'vertical' | 'horizontal';
    disabled?: boolean;
    class?: string;
    children?: JSX.Element;
}

export const CardOption: Component<CardOptionProps> = (rawProps) => {
    const props = mergeProps(
        {
            indicator: 'none' as const,
            variant: 'primary' as const,
            layout: 'horizontal' as const,
            badgeVariant: 'primary' as const,
            disabled: false,
        },
        rawProps
    );

    const variantStyles = () => {
        switch (props.variant) {
            case 'danger':
            case 'destructive':
                return {
                    selected: 'border-danger/60 bg-danger/5 shadow-xs',
                    iconBg: 'bg-danger/10 text-danger',
                    radioBorder: 'border-danger',
                    radioDot: 'bg-danger',
                    dot: 'bg-danger',
                    title: 'text-text',
                };
            case 'success':
                return {
                    selected: 'border-success/60 bg-success/8 shadow-xs',
                    iconBg: 'bg-success/15 text-success',
                    radioBorder: 'border-success',
                    radioDot: 'bg-success',
                    dot: 'bg-success',
                    title: 'text-text',
                };
            case 'warning':
                return {
                    selected: 'border-warning/60 bg-warning/8 shadow-xs',
                    iconBg: 'bg-warning/15 text-warning',
                    radioBorder: 'border-warning',
                    radioDot: 'bg-warning',
                    dot: 'bg-warning',
                    title: 'text-text',
                };
            case 'info':
                return {
                    selected: 'border-info/60 bg-info/8 shadow-xs',
                    iconBg: 'bg-info/15 text-info',
                    radioBorder: 'border-info',
                    radioDot: 'bg-info',
                    dot: 'bg-info',
                    title: 'text-text',
                };
            case 'secondary':
                return {
                    selected: 'border-secondary/60 bg-secondary/8 shadow-xs',
                    iconBg: 'bg-secondary/15 text-secondary',
                    radioBorder: 'border-secondary',
                    radioDot: 'bg-secondary',
                    dot: 'bg-secondary',
                    title: 'text-text',
                };
            case 'neutral':
                return {
                    selected: 'border-border-strong bg-surface shadow-xs',
                    iconBg: 'bg-surface-3 text-heading',
                    radioBorder: 'border-heading',
                    radioDot: 'bg-heading',
                    dot: 'bg-heading',
                    title: 'text-text',
                };
            case 'primary':
            default:
                return {
                    selected: 'border-primary bg-primary/8 shadow-xs',
                    iconBg: 'bg-primary/15 text-primary',
                    radioBorder: 'border-primary',
                    radioDot: 'bg-primary',
                    dot: 'bg-primary',
                    title: 'text-heading',
                };
        }
    };

    const renderBadge = () => {
        if (!props.badge) return null;
        if (typeof props.badge === 'string' || typeof props.badge === 'number') {
            return (
                <Badge variant={props.badgeVariant}>
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
                props.layout === 'vertical' ? 'p-4 flex flex-col items-center text-center gap-3' : 'p-3.5 flex items-start gap-3',
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
                        'size-9 rounded-lg flex items-center justify-center shrink-0 transition-colors duration-150',
                        props.isSelected ? variantStyles().iconBg : 'bg-surface text-muted'
                    )}
                >
                    {props.icon}
                </div>
            </Show>

            {/* ── Content (Title & Description) ── */}
            <div class={cn('min-w-0 flex-1', props.layout === 'vertical' && 'w-full')}>
                <div class={cn('flex items-center gap-2', props.layout === 'vertical' ? 'justify-center' : 'justify-between')}>
                    <span class={cn('text-xs font-semibold leading-snug', variantStyles().title)}>
                        {props.title}
                    </span>

                    {/* Badge (Horizontal layout) */}
                    <Show when={props.badge && props.layout === 'horizontal'}>
                        <div class="shrink-0">
                            {renderBadge()}
                        </div>
                    </Show>
                </div>

                <Show when={props.description}>
                    <p class="text-[11px] text-muted leading-relaxed mt-0.5">
                        {props.description}
                    </p>
                </Show>

                {props.children}
            </div>

            {/* ── Badge (Vertical layout top right) ── */}
            <Show when={props.badge && props.layout === 'vertical'}>
                <div class="absolute top-2.5 right-2.5">
                    {renderBadge()}
                </div>
            </Show>

            {/* ── Check indicator (Top right) ── */}
            <Show when={props.indicator === 'check' && props.isSelected}>
                <div class="size-4.5 rounded-full bg-primary text-on-primary flex items-center justify-center shrink-0 animate-in zoom-in-50 duration-100">
                    <CheckIcon class="size-3 stroke-[3]" />
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
