import { Component, For, Show } from 'solid-js';
import { cn } from '@shared/lib/utils';

export interface AuthStepperProps {
    steps: string[];
    current: number;
    class?: string;
}

export const AuthStepper: Component<AuthStepperProps> = (props) => {
    return (
        <div class={cn("flex items-center justify-center gap-2 mb-6 w-full select-none", props.class)}>
            <For each={props.steps}>{(label, i) => {
                const isCompleted = () => i() < props.current;
                const isCurrent = () => i() === props.current;
                const isLast = () => i() === props.steps.length - 1;

                return (
                    <div class="flex items-center gap-2">
                        {/* Step Circle Indicator */}
                        <div
                            class={cn(
                                "size-8 rounded-full flex items-center justify-center text-xs font-bold transition-all duration-300 shrink-0",
                                isCompleted() && "bg-primary text-on-primary shadow-xs shadow-primary/20",
                                isCurrent() && "bg-primary/15 text-primary ring-2 ring-primary ring-offset-1 ring-offset-card font-extrabold",
                                !isCompleted() && !isCurrent() && "bg-card-alt text-muted border border-border"
                            )}
                        >
                            <Show when={isCompleted()} fallback={<span>{i() + 1}</span>}>
                                <svg class="size-4" viewBox="0 0 20 20" fill="currentColor">
                                    <path
                                        fill-rule="evenodd"
                                        d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                                        clip-rule="evenodd"
                                    />
                                </svg>
                            </Show>
                        </div>

                        {/* Step Label */}
                        <span
                            class={cn(
                                "text-xs font-medium hidden sm:inline transition-colors duration-200",
                                isCurrent() ? "text-heading font-semibold" : isCompleted() ? "text-text" : "text-muted"
                            )}
                        >
                            {label}
                        </span>

                        {/* Connector line between steps */}
                        <Show when={!isLast()}>
                            <div
                                class={cn(
                                    "w-8 sm:w-12 h-0.5 transition-colors duration-300 rounded-full",
                                    isCompleted() ? "bg-primary" : "bg-border"
                                )}
                            />
                        </Show>
                    </div>
                );
            }}</For>
        </div>
    );
};

export default AuthStepper;
