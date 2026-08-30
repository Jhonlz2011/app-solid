import { Component, JSX, Show, mergeProps } from 'solid-js';
import { cn } from '../../lib/utils';
import { Badge, type BadgeVariant } from '@display/Badge';

export type SectionHeaderColor = 'primary' | 'success' | 'warning' | 'info' | 'danger' | 'accent';

export interface FormSectionHeaderProps {
    title: string | JSX.Element;
    color?: SectionHeaderColor;
    indicatorColor?: string;
    badge?: string | JSX.Element;
    badgeVariant?: BadgeVariant;
    description?: string | JSX.Element;
    action?: JSX.Element;
    children?: JSX.Element;
    class?: string;
}

const COLOR_MAP: Record<SectionHeaderColor, string> = {
    primary: 'bg-primary',
    success: 'bg-success',
    warning: 'bg-warning',
    info: 'bg-info',
    danger: 'bg-danger',
    accent: 'bg-purple-500',
};

export const FormSectionHeader: Component<FormSectionHeaderProps> = (rawProps) => {
    const props = mergeProps(
        {
            color: 'primary' as SectionHeaderColor,
            badgeVariant: 'primary' as BadgeVariant,
        },
        rawProps
    );

    const barColorClass = () => props.indicatorColor ?? COLOR_MAP[props.color] ?? 'bg-primary';

    return (
        <div class={cn('space-y-1 w-full', props.class)}>
            <div class="flex items-center justify-between gap-2">
                <div class="flex items-center gap-2 min-w-0">
                    <div class={cn('w-1.5 h-4 rounded-full shrink-0', barColorClass())} />

                    <h3 class="font-semibold text-text uppercase tracking-wide text-sm truncate">
                        {props.title}
                    </h3>

                    <Show when={props.badge}>
                        {typeof props.badge === 'string' || typeof props.badge === 'number' ? (
                            <Badge variant={props.badgeVariant} class="text-[10px] px-1.5 py-0 shrink-0">
                                {props.badge}
                            </Badge>
                        ) : (
                            props.badge
                        )}
                    </Show>

                    {props.children}
                </div>

                <Show when={props.action}>
                    <div class="flex items-center gap-2 shrink-0">
                        {props.action}
                    </div>
                </Show>
            </div>

            <Show when={props.description}>
                <p class="text-xs text-muted ml-3.5 leading-relaxed">
                    {props.description}
                </p>
            </Show>
        </div>
    );
};

export default FormSectionHeader;
