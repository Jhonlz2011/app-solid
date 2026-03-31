import { Component, JSX, Show, createEffect, onCleanup, mergeProps, createSignal, createUniqueId } from 'solid-js';
import { Portal } from 'solid-js/web';
import { XIcon, ChevronLeftIcon } from '@shared/ui/icons';
import { ScrollArea } from '@/layout/components/ScrollArea';
import { cn } from '../lib/utils';

// Global stacking registry for nested Sheets
const activeSheets: string[] = [];

interface SheetProps {
    isOpen: boolean;
    onClose: () => void;
    /** Optional back handler — shows a back arrow button in the header */
    onBack?: () => void;
    title?: string;
    description?: string;
    children: JSX.Element;
    /** Optional sticky footer — rendered outside the scroll area, always visible at the bottom */
    footer?: JSX.Element;
    side?: 'left' | 'right';
    size?: 'sm' | 'md' | 'lg' | 'xl' | 'xxl' | 'xxxl' | 'xxxxl' | 'full';
    /** Binding callback to expose internal animated dismiss function to the parent */
    bindDismiss?: (dismiss: () => void) => void;
}

const Sheet: Component<SheetProps> = (rawProps) => {
    const props = mergeProps({ side: 'right', size: 'md' }, rawProps);

    const sizeClasses = {
        sm: 'max-w-sm',
        md: 'max-w-md',
        lg: 'max-w-lg',
        xl: 'max-w-xl',
        xxl: 'max-w-2xl',
        xxxl: 'max-w-3xl',
        xxxxl: 'max-w-4xl',
        full: 'max-w-full',
    };

    const sheetId = createUniqueId();

    createEffect(() => {
        if (props.isOpen) {
            activeSheets.push(sheetId);
            document.body.style.overflow = 'hidden';
            window.addEventListener('keydown', handleKeyDown);
        } else {
            cleanupSheet();
        }
    });

    const cleanupSheet = () => {
        const idx = activeSheets.indexOf(sheetId);
        if (idx > -1) activeSheets.splice(idx, 1);
        
        if (activeSheets.length === 0) {
            document.body.style.overflow = '';
        }
        window.removeEventListener('keydown', handleKeyDown);
    };

    let dismissTimeout: ReturnType<typeof setTimeout>;

    onCleanup(() => {
        clearTimeout(dismissTimeout);
        cleanupSheet();
    });

    const [isClosing, setIsClosing] = createSignal(false);

    const handleDismiss = () => {
        if (isClosing()) return;
        setIsClosing(true);
        dismissTimeout = setTimeout(() => {
            if (props.onBack) props.onBack();
            else props.onClose();
        }, 200); // 200ms duration for the exit animation
    };

    if (props.bindDismiss) {
        props.bindDismiss(handleDismiss);
    }

    const handleKeyDown = (e: KeyboardEvent) => {
        // Only the visually topmost sheet should handle the escape key
        if (e.key === 'Escape' && activeSheets[activeSheets.length - 1] === sheetId) {
            e.preventDefault();
            handleDismiss();
        }
    };

    return (
        <Show when={props.isOpen}>
            <Portal>
                <div class={cn("fixed inset-0 flex justify-end", props.onBack ? "z-[60]" : "z-50")}>
                    {/* Overlay */}
                    <div
                        class={cn(
                            "fixed inset-0 transition-opacity duration-200 fill-mode-forwards",
                            props.onBack ? "bg-black/30" : "bg-black/60 backdrop-blur-sm",
                            isClosing() ? "opacity-0" : "animate-in fade-in opacity-100"
                        )}
                        onClick={handleDismiss}
                    />
                    {/* Sheet Panel */}
                    <div
                        class={cn(
                            `relative z-50 h-full w-full ${sizeClasses[props.size as keyof typeof sizeClasses]}`,
                            `bg-card border-l border-border shadow-2xl flex flex-col fill-mode-forwards`,
                            !isClosing() 
                                ? props.onBack 
                                    ? "animate-in fade-in zoom-in-95 duration-200"
                                    : "animate-in slide-in-from-right duration-300" 
                                : props.onBack 
                                    ? "animate-out fade-out zoom-out-95 duration-200" 
                                    : "animate-out slide-out-to-right duration-200"
                        )}
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* Header — flex-none, always visible */}
                        <div class="flex items-center justify-between px-4 py-4 border-b border-border bg-muted/10 flex-none">
                            <div class="flex items-center gap-3">
                                <Show when={props.onBack}>
                                    <button
                                        onClick={handleDismiss}
                                        class="p-2 rounded-lg hover:bg-surface text-muted hover:text-text transition-colors cursor-pointer -ml-1"
                                        aria-label="Volver"
                                    >
                                        <ChevronLeftIcon class="size-4" />
                                    </button>
                                </Show>
                                <div class="space-y-1">
                                    <Show when={props.title}>
                                        <h2 class="text-lg font-semibold text-text">{props.title}</h2>
                                    </Show>
                                    <Show when={props.description}>
                                        <p class="text-sm text-muted">{props.description}</p>
                                    </Show>
                                </div>
                            </div>
                            <button
                                onClick={handleDismiss}
                                class="p-2.5 rounded-lg hover:bg-surface text-muted hover:text-text transition-colors cursor-pointer"
                            >
                                <XIcon class='size-4' />
                            </button>
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
                    </div>
                </div>
            </Portal>
        </Show>
    );
};

export default Sheet;
