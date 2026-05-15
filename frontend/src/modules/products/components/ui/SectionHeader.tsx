/**
 * SectionHeader — Reusable fieldset header with color dot + title + optional badge.
 * Eliminates ~5 lines of duplication per section.
 */
import { Component, Show, JSX } from 'solid-js';
import { Badge } from '@shared/ui/Badge';

interface SectionHeaderProps {
    color: 'primary' | 'success' | 'warning' | 'info' | 'danger' | 'accent';
    title: string;
    badge?: string;
    badgeVariant?: 'primary' | 'info' | 'success' | 'warning';
    description?: string;
    children?: JSX.Element;
}

const COLOR_MAP: Record<string, string> = {
    primary: 'bg-primary',
    success: 'bg-success',
    warning: 'bg-warning',
    info: 'bg-info',
    danger: 'bg-danger',
    accent: 'bg-accent',
};

const SectionHeader: Component<SectionHeaderProps> = (props) => (
    <div class="space-y-1">
        <div class="flex items-center gap-2">
            <div class={`w-1.5 h-4 rounded-full ${COLOR_MAP[props.color] ?? 'bg-primary'}`} />
            <h3 class="font-semibold text-text uppercase tracking-wide text-sm">{props.title}</h3>
            <Show when={props.badge}>
                <Badge variant={props.badgeVariant ?? 'primary'} class="text-[10px] px-1.5 py-0">
                    {props.badge}
                </Badge>
            </Show>
            {props.children}
        </div>
        <Show when={props.description}>
            <p class="text-xs text-muted ml-3">{props.description}</p>
        </Show>
    </div>
);

export default SectionHeader;
