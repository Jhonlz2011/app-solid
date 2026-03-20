import { Component, JSX } from 'solid-js';
import { Dialog } from '@kobalte/core';
import { CloseIcon } from './icons';
import Button from './Button';

interface FormDialogProps {
    isOpen: boolean;
    onClose: () => void;
    title: string;
    children: JSX.Element;
    onSubmit: (e: Event) => void;
    submitLabel?: string;
    cancelLabel?: string;
    isLoading?: boolean;
    maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl' | '4xl';
}

const maxWidthClasses = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-lg',
    xl: 'max-w-xl',
    '2xl': 'max-w-2xl',
    '3xl': 'max-w-3xl',
    '4xl': 'max-w-4xl',
};

/**
 * Reusable form dialog wrapper with consistent styling.
 * Provides overlay, header with close button, form wrapper, and footer buttons.
 */
export const FormDialog: Component<FormDialogProps> = (props) => {
    const maxWidth = () => maxWidthClasses[props.maxWidth ?? 'md'];

    return (
        <Dialog.Root open={props.isOpen} onOpenChange={(open) => !open && props.onClose()}>
            <Dialog.Portal>
                <Dialog.Overlay class="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm" />
                <div class="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <Dialog.Content class={`bg-card border border-border shadow-card-soft rounded-2xl shadow-2xl w-full ${maxWidth()}`}>
                        {/* Header */}
                        <div class="flex items-center justify-between px-6 py-4 border-b border-surface">
                            <Dialog.Title class="text-lg font-semibold">
                                {props.title}
                            </Dialog.Title>
                            <Dialog.CloseButton class="p-2 rounded-lg hover:bg-surface text-muted transition-colors">
                                <CloseIcon />
                            </Dialog.CloseButton>
                        </div>

                        {/* Form */}
                        <form onSubmit={props.onSubmit} class="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
                            {props.children}

                            {/* Footer */}
                            <div class="flex justify-end gap-3 pt-4 border-t border-surface">
                                <Button
                                    variant="ghost"
                                    onClick={props.onClose}
                                >
                                    {props.cancelLabel ?? 'Cancelar'}
                                </Button>
                                <Button
                                    type="submit"
                                    variant="primary"
                                    loading={props.isLoading}
                                    loadingText="Guardando..."
                                >
                                    {props.submitLabel ?? 'Guardar'}
                                </Button>
                            </div>
                        </form>
                    </Dialog.Content>
                </div>
            </Dialog.Portal>
        </Dialog.Root>
    );
};

export default FormDialog;
