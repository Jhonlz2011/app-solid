import { Component, JSX, Show, createEffect, onCleanup, mergeProps } from 'solid-js';
import { Portal } from 'solid-js/web';
import { XIcon } from '@shared/ui/icons';

interface SheetProps {
    isOpen: boolean;
    onClose: () => void;
    title?: string;
    description?: string;
    children: JSX.Element;
    side?: 'left' | 'right';
    size?: 'sm' | 'md' | 'lg' | 'xl' | 'full';
}

const Sheet: Component<SheetProps> = (rawProps) => {
    const props = mergeProps({ side: 'right', size: 'md' }, rawProps);

    const sizeClasses = {
        sm: 'max-w-sm',
        md: 'max-w-md',
        lg: 'max-w-lg',
        xl: 'max-w-xl',
        full: 'max-w-full',
    };

    createEffect(() => {
        if (props.isOpen) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = '';
        }
    });

    onCleanup(() => {
        document.body.style.overflow = '';
    });

    const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Escape') {
            props.onClose();
        }
    };

    createEffect(() => {
        if (props.isOpen) {
            window.addEventListener('keydown', handleKeyDown);
        }
        return () => window.removeEventListener('keydown', handleKeyDown);
    });

    return (
        <Show when={props.isOpen}>
            <Portal>
                <div class="fixed inset-0 z-50 flex justify-end">
                    {/* Overlay */}
                    <div
                        class="fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity animate-in fade-in duration-300"
                        onClick={props.onClose}
                    />
                    {/* Sheet Panel */}
                    <div
                        class={`
                            relative z-50 h-full w-full ${sizeClasses[props.size as keyof typeof sizeClasses]} 
                            bg-card border-l border-border shadow-2xl 
                            flex flex-col 
                            animate-in slide-in-from-right duration-300
                        `}
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* Header */}
                        <div class="flex items-center justify-between px-6 py-4 border-b border-border bg-muted/10">
                            <div class="space-y-1">
                                <Show when={props.title}>
                                    <h2 class="text-lg font-semibold text-text">{props.title}</h2>
                                </Show>
                                <Show when={props.description}>
                                    <p class="text-sm text-muted">{props.description}</p>
                                </Show>
                            </div>
                            <button
                                onClick={props.onClose}
                                class="p-2 rounded-lg hover:bg-surface text-muted hover:text-text transition-colors"
                            >
                                <XIcon />
                            </button>
                        </div>

                        {/* Content */}
                        <div class="flex-1 overflow-y-auto p-6">
                            {props.children}
                        </div>
                    </div>
                </div>
            </Portal>
        </Show>
    );
};

export default Sheet;
