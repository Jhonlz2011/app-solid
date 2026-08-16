import { Component, JSX, Show, createEffect, mergeProps } from 'solid-js';
import { Dialog } from '@kobalte/core';
import { XIcon, InfoIcon } from '@shared/ui/icons';
import { ScrollArea } from '@/layout/components/ScrollArea';
import { cn } from '../lib/utils';
import { Tooltip } from './Tooltip';

export interface SheetProps {
    isOpen: boolean;
    onClose: () => void;
    title?: string;
    description?: string;
    children: JSX.Element;
    /** Optional sticky footer — rendered outside the scroll area, always visible at the bottom */
    footer?: JSX.Element;
    side?: 'left' | 'right';
    size?: 'sm' | 'md' | 'lg' | 'xl' | 'xxl' | 'xxxl' | 'xxxxl' | '5xl' | 'full';
    /** Binding callback to expose internal dismiss function to the parent */
    bindDismiss?: (dismiss: () => void) => void;
}

const sizeClasses: Record<NonNullable<SheetProps['size']>, string> = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-lg',
    xl: 'max-w-xl',
    xxl: 'max-w-2xl',
    xxxl: 'max-w-3xl',
    xxxxl: 'max-w-4xl',
    '5xl': 'max-w-5xl',
    full: 'max-w-full',
};

export const Sheet: Component<SheetProps> = (rawProps) => {
    const props = mergeProps({ side: 'right' as const, size: 'md' as const }, rawProps);

    // Wire up dismiss function for useSheetNavigation and parent consumers
    createEffect(() => {
        props.bindDismiss?.(props.onClose);
    });

    const isLeft = () => props.side === 'left';

    return (
        <Dialog.Root
            open={props.isOpen}
            onOpenChange={(open) => !open && props.onClose()}
        >
            <Dialog.Portal>
                {/* Backdrop Overlay */}
                <Dialog.Overlay
                    class="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm transition-opacity duration-200 animate-in fade-in data-[closed]:animate-out data-[closed]:fade-out-0 data-[closed]:duration-200"
                />

                {/* Sheet Panel */}
                <Dialog.Content
                    class={cn(
                        'fixed inset-y-0 z-50 h-full w-full bg-card shadow-2xl flex flex-col outline-none fill-mode-forwards',
                        sizeClasses[props.size],
                        isLeft()
                            ? 'left-0 border-r border-border animate-in slide-in-from-left duration-300 data-[closed]:animate-out data-[closed]:slide-out-to-left data-[closed]:duration-200'
                            : 'right-0 border-l border-border animate-in slide-in-from-right duration-300 data-[closed]:animate-out data-[closed]:slide-out-to-right data-[closed]:duration-200'
                    )}
                >
                    {/* Header — flex-none, always visible */}
                    <div class="flex items-center justify-between px-4 py-3 border-b border-border bg-muted/10 flex-none">
                        <div class="flex items-center gap-3">
                            <div class="flex items-center gap-2">
                                <Show when={props.title}>
                                    <Dialog.Title class="text-lg font-semibold text-text">
                                        {props.title}
                                    </Dialog.Title>
                                </Show>
                                <Show when={props.description}>
                                    <Dialog.Description class="sr-only">
                                        {props.description}
                                    </Dialog.Description>
                                    <Tooltip content={props.description} placement="right" delay={0}>
                                        <InfoIcon class="size-4 text-muted hover:text-text cursor-help transition-colors" />
                                    </Tooltip>
                                </Show>
                            </div>
                        </div>
                        <Dialog.CloseButton
                            class="p-2.5 rounded-lg hover:bg-surface text-muted hover:text-text transition-colors cursor-pointer"
                        >
                            <XIcon class="size-4" />
                        </Dialog.CloseButton>
                    </div>

                    {/* Content — ScrollArea is the single scroll context */}
                    <ScrollArea class="flex-1 min-h-0 px-4">
                        {props.children}
                    </ScrollArea>

                    {/* Footer — flex-none, always visible at bottom */}
                    <Show when={props.footer}>
                        <div class="flex-none px-4 py-4 border-t border-border bg-card shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
                            <div class="flex items-center justify-end gap-3">
                                {props.footer}
                            </div>
                        </div>
                    </Show>
                </Dialog.Content>
            </Dialog.Portal>
        </Dialog.Root>
    );
};

export default Sheet;
