import { Component, JSX, Show, createUniqueId } from 'solid-js';
import { Dialog } from '@kobalte/core';
import { CloseIcon } from './icons';
import Button from './Button';

interface FormDialogProps {
    isOpen: boolean;
    onClose: () => void;
    title: string;
    /** Extra JSX rendered inline right of the title (e.g. a badge) */
    titleExtra?: JSX.Element;
    children: JSX.Element;
    onSubmit: (e: Event) => void;
    submitLabel?: string;
    cancelLabel?: string;
    isLoading?: boolean;
    maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl' | '4xl';
    /** Optional subtitle or description below title */
    subtitle?: string;
    /** Hide footer entirely (e.g. for read-only views) */
    hideFooter?: boolean;
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
 * Header + scrollable body + sticky footer.
 */
export const FormDialog: Component<FormDialogProps> = (props) => {
    const maxWidth = () => maxWidthClasses[props.maxWidth ?? 'md'];
    const formId = createUniqueId();

    return (
        <Dialog.Root open={props.isOpen} onOpenChange={(open) => !open && props.onClose()}>
            <Dialog.Portal>
                <Dialog.Overlay class="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm" />
                <div class="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <Dialog.Content
                        class={`bg-card border border-border shadow-card-soft rounded-2xl shadow-2xl w-full flex flex-col max-h-[85vh] ${maxWidth()}`}
                    >
                        {/* ── Header (sticky) ── */}
                        <div class="flex items-center justify-between px-5 py-4 border-b border-surface shrink-0">
                            <div class="flex items-center gap-3 min-w-0">
                                <div>
                                    <Dialog.Title class="text-lg font-semibold">
                                        {props.title}
                                    </Dialog.Title>
                                    <Show when={props.subtitle}>
                                        <p class="text-xs text-muted mt-0.5">{props.subtitle}</p>
                                    </Show>
                                </div>
                                {props.titleExtra}
                            </div>
                            <Dialog.CloseButton class="p-2 rounded-lg hover:bg-surface text-muted transition-colors cursor-pointer">
                                <CloseIcon />
                            </Dialog.CloseButton>
                        </div>

                        {/* ── Scrollable body ── */}
                        <form
                            id={formId}
                            onSubmit={props.onSubmit}
                            class="px-4 space-y-4 overflow-y-auto flex-1 min-h-0"
                        >
                            {props.children}
                        </form>

                        {/* ── Sticky footer ── */}
                        <Show when={!props.hideFooter}>
                            <div class="flex justify-end gap-3 px-5 py-4 border-t border-surface shrink-0 bg-card rounded-b-2xl">
                                <Button
                                    variant="outline"
                                    onClick={props.onClose}
                                >
                                    {props.cancelLabel ?? 'Cancelar'}
                                </Button>
                                <Button
                                    type="submit"
                                    form={formId}
                                    variant="primary"
                                    loading={props.isLoading}
                                    loadingText="Guardando..."
                                >
                                    {props.submitLabel ?? 'Guardar'}
                                </Button>
                            </div>
                        </Show>
                    </Dialog.Content>
                </div>
            </Dialog.Portal>
        </Dialog.Root>
    );
};

export default FormDialog;
