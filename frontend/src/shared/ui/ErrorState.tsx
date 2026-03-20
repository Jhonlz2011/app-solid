import { Component, Show, JSX } from 'solid-js';
import { WarningIcon } from './icons';
import Button from './Button';
import { cn } from '../lib/utils';

export interface ErrorStateProps {
    title?: string;
    description?: string;
    onRetry?: () => void;
    retryLabel?: string;
    class?: string;
    icon?: JSX.Element;
    size?: 'sm' | 'md' | 'lg'; // Controls padding and icon sizing
}

export const ErrorState: Component<ErrorStateProps> = (props) => {
    const isSm = () => props.size === 'sm';
    
    return (
        <div class={cn("text-center flex flex-col items-center justify-center", props.class || (isSm() ? 'py-8' : 'py-16'))}>
            <div class={cn(
                "mx-auto rounded-full bg-danger/10 flex items-center justify-center mb-4",
                isSm() ? 'size-12' : 'size-16'
            )}>
                <Show when={props.icon} fallback={<WarningIcon class={cn("text-danger", isSm() ? 'size-6' : 'size-8')} />}>
                    {props.icon}
                </Show>
            </div>
            
            <Show when={props.title}>
                <h3 class={cn("font-semibold text-danger mb-1", isSm() ? 'text-base' : 'text-lg')}>{props.title}</h3>
            </Show>
            
            <Show when={props.description}>
                <p class={cn("text-danger/80 mb-4", isSm() ? 'text-xs' : 'text-sm')}>
                    {props.description}
                </p>
            </Show>
            
            <Show when={props.onRetry}>
                <div class="">
                    <Button 
                        variant="ghost" 
                        size={isSm() ? "sm" : "md"}
                        onClick={props.onRetry}
                        class="bg-danger/10 text-danger hover:bg-danger/20 hover:text-danger-strong transition-colors border-0"
                    >
                        {props.retryLabel || 'Reintentar'}
                    </Button>
                </div>
            </Show>
        </div>
    );
};

export default ErrorState;
