/**
 * ImageLightboxModal — High-performance reusable image lightbox preview modal.
 * Opens full-size high-resolution images in an accessible Kobalte Dialog overlay with backdrop blur.
 * Keyboard accessible (ESC closes) and zero direct DOM manipulation.
 */
import { Component, Show } from 'solid-js';
import { Dialog } from '@kobalte/core';
import { XIcon } from './icons';
import { cn } from '../lib/utils';

export interface ImageLightboxModalProps {
    src: string | null;
    alt?: string;
    onClose: () => void;
}

export const ImageLightboxModal: Component<ImageLightboxModalProps> = (props) => {
    return (
        <Dialog.Root
            open={Boolean(props.src)}
            onOpenChange={(open) => !open && props.onClose()}
        >
            <Dialog.Portal>
                {/* Backdrop Overlay */}
                <Dialog.Overlay
                    class="fixed inset-0 z-50 bg-black/80 backdrop-blur-md animate-in fade-in duration-200 data-[closed]:animate-out data-[closed]:fade-out-0 data-[closed]:duration-150 cursor-zoom-out"
                />

                {/* Dialog Content Container */}
                <div class="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 pointer-events-none">
                    <Dialog.Content
                        class={cn(
                            'relative pointer-events-auto max-w-4xl max-h-[85vh] w-auto h-auto overflow-hidden rounded-2xl border border-white/10 shadow-2xl bg-black/40 cursor-default flex items-center justify-center',
                            'animate-in zoom-in-95 fade-in duration-200',
                            'data-[closed]:animate-out data-[closed]:zoom-out-95 data-[closed]:fade-out-0 data-[closed]:duration-150',
                            'outline-none'
                        )}
                    >
                        <Dialog.Title class="sr-only">
                            {props.alt ?? 'Vista previa de imagen'}
                        </Dialog.Title>
                        <Dialog.Description class="sr-only">
                            Visualización de imagen en tamaño completo
                        </Dialog.Description>

                        {/* Close button */}
                        <Dialog.CloseButton
                            class="absolute top-4 right-4 z-10 p-2.5 rounded-full bg-surface/20 text-white hover:bg-surface/40 hover:scale-110 active:scale-95 transition-all cursor-pointer shadow-lg border border-white/20"
                            title="Cerrar (Esc)"
                        >
                            <XIcon class="size-5" />
                        </Dialog.CloseButton>

                        {/* Image */}
                        <Show when={props.src}>
                            {(imageSrc) => (
                                <img
                                    src={imageSrc()}
                                    alt={props.alt ?? 'Vista previa'}
                                    class="max-w-full max-h-[85vh] object-contain select-none transition-transform duration-300"
                                />
                            )}
                        </Show>
                    </Dialog.Content>
                </div>
            </Dialog.Portal>
        </Dialog.Root>
    );
};

export default ImageLightboxModal;
