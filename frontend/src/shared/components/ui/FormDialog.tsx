import { Component, JSX, Show } from 'solid-js';
import { Dialog } from '@kobalte/core';
import { CloseIcon } from '../icons';

interface FormDialogProps {
    isOpen: boolean;
    onClose: () => void;
    title: string;
    children: JSX.Element;
    onSubmit: (e: Event) => void;
    submitLabel?: string;
    cancelLabel?: string;
    isLoading?: boolean;
    maxWidth?: 'sm' | 'md' | 'lg' | 'xl';
}

const maxWidthClasses = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-lg',
    xl: 'max-w-xl',
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
                    <Dialog.Content class={`card-panel rounded-2xl shadow-2xl w-full ${maxWidth()}`}>
                        {/* Header */}
                        <div class="flex items-center justify-between px-6 py-4 border-b border-surface">
                            <Dialog.Title class="text-lg font-semibold title-primary">
                                {props.title}
                            </Dialog.Title>
                            <Dialog.CloseButton class="p-2 rounded-lg hover:bg-surface text-muted transition-colors">
                                <CloseIcon />
                            </Dialog.CloseButton>
                        </div>

                        {/* Form */}
                        <form onSubmit={props.onSubmit} class="p-6 space-y-4">
                            {props.children}

                            {/* Footer */}
                            <div class="flex justify-end gap-3 pt-4 border-t border-surface">
                                <button
                                    type="button"
                                    onClick={props.onClose}
                                    class="btn btn-ghost"
                                >
                                    {props.cancelLabel ?? 'Cancelar'}
                                </button>
                                <button
                                    type="submit"
                                    disabled={props.isLoading}
                                    class="btn btn-primary"
                                >
                                    <Show when={props.isLoading} fallback={props.submitLabel ?? 'Guardar'}>
                                        Guardando...
                                    </Show>
                                </button>
                            </div>
                        </form>
                    </Dialog.Content>
                </div>
            </Dialog.Portal>
        </Dialog.Root>
    );
};

export default FormDialog;
