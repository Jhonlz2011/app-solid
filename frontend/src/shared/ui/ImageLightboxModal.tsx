/**
 * ImageLightboxModal — High-performance reusable image lightbox preview modal.
 * Opens full-size high-resolution images in a clean overlay with backdrop blur.
 * Keyboard accessible (ESC closes).
 */
import { Component, Show, createEffect, onCleanup } from 'solid-js';
import { XIcon } from './icons';

export interface ImageLightboxModalProps {
    src: string | null;
    alt?: string;
    onClose: () => void;
}

export const ImageLightboxModal: Component<ImageLightboxModalProps> = (props) => {
    // ESC key listener
    const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Escape') {
            props.onClose();
        }
    };

    createEffect(() => {
        if (props.src) {
            window.addEventListener('keydown', handleKeyDown);
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = '';
        }
    });

    onCleanup(() => {
        window.removeEventListener('keydown', handleKeyDown);
        document.body.style.overflow = '';
    });

    return (
        <Show when={props.src}>
            {(imageSrc) => (
                <div
                    class="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/80 backdrop-blur-md transition-opacity duration-200 animate-in fade-in cursor-zoom-out"
                    onClick={props.onClose}
                    role="dialog"
                    aria-modal="true"
                >
                    {/* Close button */}
                    <button
                        type="button"
                        onClick={(e) => {
                            e.stopPropagation();
                            props.onClose();
                        }}
                        class="absolute top-4 right-4 z-10 p-2.5 rounded-full bg-surface/20 text-white hover:bg-surface/40 hover:scale-110 active:scale-95 transition-all cursor-pointer shadow-lg border border-white/20"
                        title="Cerrar (Esc)"
                    >
                        <XIcon class="size-5" />
                    </button>

                    {/* Image container */}
                    <div
                        class="relative max-w-4xl max-h-[85vh] w-auto h-auto overflow-hidden rounded-2xl border border-white/10 shadow-2xl bg-black/40 cursor-default flex items-center justify-center"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <img
                            src={imageSrc()}
                            alt={props.alt ?? 'Vista previa'}
                            class="max-w-full max-h-[85vh] object-contain select-none transition-transform duration-300"
                        />
                    </div>
                </div>
            )}
        </Show>
    );
};

export default ImageLightboxModal;
