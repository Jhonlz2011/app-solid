import { Component, Show, JSX } from 'solid-js';
import { Dialog } from '@kobalte/core';
import { CloseIcon } from './icons';
import Button from './Button';
import { cn } from '../lib/utils';

interface ConfirmDialogProps {
    /** Controls the dialog visibility */
    isOpen: boolean;
    /** Called when the dialog should close (cancel, overlay click, or ESC) */
    onClose: () => void;
    /** Called when the user confirms the action */
    onConfirm: () => void;
    /** Dialog title */
    title: string;
    /** Description or detailed message */
    description: string;
    /** Confirm button label (default: "Eliminar") */
    confirmLabel?: string;
    /** Cancel button label (default: "Cancelar") */
    cancelLabel?: string;
    /** Text to show in the button while loading */
    loadingText?: string;
    /** Visual variant — changes the confirm button style */
    variant?: 'danger' | 'destructive' | 'warning' | 'primary' | 'success';
    /** Show loading state on confirm button */
    isLoading?: boolean;
    /** Optional icon to display above the title */
    icon?: JSX.Element;
}

/**
 * Reusable confirmation dialog.
 * Fully responsive, uses global Button component, and prevents layout shifts.
 */
const ConfirmDialog: Component<ConfirmDialogProps> = (props) => {
    const variant = () => props.variant ?? 'danger';

    return (
        <Dialog.Root
            open={props.isOpen}
            onOpenChange={(open) => !open && props.onClose()}
        >
            <Dialog.Portal>
                <Dialog.Overlay class="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm animate-in fade-in" />
                
                {/* Responsive bounds: bottom-sheet on mobile, centered modal on sm+ */}
                <div class="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4">
                    <Dialog.Content class={cn(
                        'bg-card border-t sm:border border-border',
                        'rounded-t-2xl sm:rounded-2xl shadow-2xl',
                        'w-full sm:max-w-sm',
                        'animate-in slide-in-from-bottom sm:slide-in-from-bottom-0 sm:zoom-in-95 fade-in',
                        'overflow-hidden' // prevents scroll flash on entry
                    )}>
                        {/* Header */}
                        <div class="flex items-start justify-between px-5 sm:px-6 pt-5 sm:pt-6 pb-2">
                            <div class="flex-1">
                                <Show when={props.icon}>
                                    <div class="mb-3">{props.icon}</div>
                                </Show>
                                <Dialog.Title class="text-base sm:text-lg font-semibold text-text">
                                    {props.title}
                                </Dialog.Title>
                            </div>
                            <Dialog.CloseButton class="p-1.5 rounded-lg hover:bg-surface text-muted cursor-pointer transition-colors shrink-0 -mr-1 -mt-1">
                                <CloseIcon class="size-5" />
                            </Dialog.CloseButton>
                        </div>

                        {/* Description */}
                        <div class="px-5 sm:px-6 pb-5 sm:pb-6">
                            <Dialog.Description class="text-sm text-muted mt-1.5 leading-relaxed">
                                {props.description}
                            </Dialog.Description>
                        </div>

                        {/* Actions */}
                        <div class="flex items-center justify-end gap-2 px-5 sm:px-6 pb-5 sm:pb-6">
                            <Button
                                variant="outline"
                                onClick={props.onClose}
                                disabled={props.isLoading}
                                class="shrink-0"
                            >
                                {props.cancelLabel ?? 'Cancelar'}
                            </Button>
                            <Button
                                variant={variant()}
                                onClick={() => props.onConfirm()}
                                disabled={props.isLoading}
                                loading={props.isLoading}
                                loadingText={props.loadingText ?? 'Eliminando...'}
                                class="shrink-0"
                            >
                                {props.confirmLabel ?? 'Eliminar'}
                            </Button>
                        </div>
                    </Dialog.Content>
                </div>
            </Dialog.Portal>
        </Dialog.Root>
    );
};

export default ConfirmDialog;
