import { Component, JSX, Show } from 'solid-js';

interface EmptyStateProps {
    icon?: JSX.Element;
    message: string;
    description?: string;
    action?: JSX.Element;
}

const DefaultIcon = () => (
    <svg class="w-12 h-12 text-muted/50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
    </svg>
);

export const EmptyState: Component<EmptyStateProps> = (props) => (
    <div class="flex flex-col items-center justify-center py-12 text-center">
        <div class="mb-4">
            {props.icon ?? <DefaultIcon />}
        </div>
        <h3 class="text-lg font-medium title-primary mb-1">{props.message}</h3>
        <Show when={props.description}>
            <p class="text-sm text-muted mb-4">{props.description}</p>
        </Show>
        <Show when={props.action}>
            <div class="mt-4">{props.action}</div>
        </Show>
    </div>
);

export default EmptyState;
