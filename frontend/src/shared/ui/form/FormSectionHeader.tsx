import { Component, JSX, Show, mergeProps } from 'solid-js';
import { cn } from '../../lib/utils';
import { Badge, type BadgeVariant } from '@display/Badge';

export interface FormSectionHeaderProps {
    title: string | JSX.Element;
    indicatorColor?: string;
    badge?: string | JSX.Element;
    badgeVariant?: BadgeVariant;
    action?: JSX.Element;
    class?: string;
}

export const FormSectionHeader: Component<FormSectionHeaderProps> = (rawProps) => {
    const props = mergeProps(
        {
            indicatorColor: 'bg-primary',
            badgeVariant: 'primary' as BadgeVariant,
        },
        rawProps
    );

    return (
        <div class={cn('flex items-center justify-between', props.class)}>
            <div class="text-xs font-semibold text-text tracking-wider flex items-center gap-2">
                <div class={cn('size-1.5 h-4 rounded-full shrink-0', props.indicatorColor)} />
                <span>{props.title}</span>
            </div>

            <div class="flex items-center gap-2">
                <Show when={props.badge}>
                    {typeof props.badge === 'string' || typeof props.badge === 'number' ? (
                        <Badge variant={props.badgeVariant}>
                            {props.badge}
                        </Badge>
                    ) : (
                        props.badge
                    )}
                </Show>

                <Show when={props.action}>
                    {props.action}
                </Show>
            </div>
        </div>
    );
};

export default FormSectionHeader;
