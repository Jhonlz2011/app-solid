import { Component, Show, JSX } from 'solid-js';
import { Dialog } from '@kobalte/core';
import { CloseIcon } from './icons';
import Button from './Button';

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
    /** Visual variant — changes the confirm button style */
    variant?: 'danger' | 'warning';
    /** Show loading state on confirm button */
    isLoading?: boolean;
    /** Optional icon to display above the title */
    icon?: JSX.Element;
}

/**
 * Reusable confirmation dialog with destructive action styling.
 * Replaces native window.confirm() with a styled, accessible dialog.
 *
 * @example
 * <ConfirmDialog
 *     isOpen={showConfirm()}
 *     onClose={() => setShowConfirm(false)}
 *     onConfirm={handleDelete}
 *     title="¿Eliminar proveedor?"
 *     description='Esta acción no se puede deshacer.'
 *     isLoading={deleteMutation.isPending}
 * />
 */
const ConfirmDialog: Component<ConfirmDialogProps> = (props) => {
    const variant = () => props.variant ?? 'danger';

    const confirmButtonClass = () =>
        variant() === 'danger'
            ? 'bg-red-600 hover:bg-red-700 text-white shadow-lg shadow-red-500/20'
            : 'bg-amber-500 hover:bg-amber-600 text-white shadow-lg shadow-amber-500/20';

    return (
        <Dialog.Root
            open={props.isOpen}
            onOpenChange={(open) => !open && props.onClose()}
        >
            <Dialog.Portal>
                <Dialog.Overlay class="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm animate-in fade-in" />
                <div class="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <Dialog.Content class="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-sm animate-in zoom-in-95 fade-in">
                        {/* Header */}
                        <div class="flex items-start justify-between px-6 pt-6 pb-2">
                            <div class="flex-1">
                                <Show when={props.icon}>
                                    <div class="mb-3">{props.icon}</div>
                                </Show>
                                <Dialog.Title class="text-lg font-semibold text-text">
                                    {props.title}
                                </Dialog.Title>
                            </div>
                            <Dialog.CloseButton class="p-1.5 rounded-lg hover:bg-surface text-muted transition-colors -mr-1 -mt-1">
                                <CloseIcon />
                            </Dialog.CloseButton>
                        </div>

                        {/* Description */}
                        <div class="px-6 pb-6">
                            <Dialog.Description class="text-sm text-muted mt-1.5 leading-relaxed">
                                {props.description}
                            </Dialog.Description>
                        </div>

                        {/* Actions */}
                        <div class="flex justify-end gap-3 px-6 pb-6">
                            <Button
                                variant="outline"
                                onClick={props.onClose}
                                disabled={props.isLoading}
                            >
                                {props.cancelLabel ?? 'Cancelar'}
                            </Button>
                            <button
                                onClick={() => props.onConfirm()}
                                disabled={props.isLoading}
                                class={`inline-flex items-center justify-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed ${confirmButtonClass()}`}
                            >
                                <Show when={props.isLoading} fallback={props.confirmLabel ?? 'Eliminar'}>
                                    <span class="inline-block size-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                    Eliminando...
                                </Show>
                            </button>
                        </div>
                    </Dialog.Content>
                </div>
            </Dialog.Portal>
        </Dialog.Root>
    );
};

export default ConfirmDialog;
