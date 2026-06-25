import { Component, JSX, Show, createEffect, onCleanup } from 'solid-js';
import { Portal } from 'solid-js/web';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: JSX.Element | string;
  description?: JSX.Element | string;
  children: JSX.Element;
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'full';
  class?: string;
}

const Modal: Component<ModalProps> = (props) => {
  const sizeClasses = {
    sm: 'max-w-md',
    md: 'max-w-2xl',
    lg: 'max-w-4xl',
    xl: 'max-w-6xl',
    full: 'max-w-[calc(100vw-2rem)]',
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
        <div class="fixed inset-0 z-50 overflow-y-auto">
          {/* Overlay */}
          <div
            class="fixed inset-0 bg-black/60 backdrop-blur-md transition-opacity"
            onClick={props.onClose}
          />

          {/* Modal */}
          <div class="flex min-h-full items-center justify-center p-4">
            <div
              class={`relative w-full ${sizeClasses[props.size || 'md']} bg-card/95 backdrop-blur-xl border border-white/10 dark:border-white/5 rounded-[1.25rem] shadow-[0_8px_32px_rgba(0,0,0,0.24)] transform transition-all flex flex-col overflow-hidden ${props.class || ''}`}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div class="flex items-center justify-between px-6 py-4 border-b border-white/5 bg-black/5 dark:bg-white/5">
                <div>
                  <h3 class="text-xl font-semibold">{props.title}</h3>
                  <Show when={props.description}>
                    <p class="text-sm text-muted mt-1">{props.description}</p>
                  </Show>
                </div>
                <button
                  onClick={props.onClose}
                  class="text-muted hover:bg-black/10 dark:hover:bg-white/10 hover:text-text transition-colors p-2 rounded-lg"
                  aria-label="Cerrar"
                >
                  <svg class="size-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Content */}
              <div class="px-6 py-4 max-h-[calc(100vh-200px)] overflow-y-auto">
                {props.children}
              </div>
            </div>
          </div>
        </div>
      </Portal>
    </Show>
  );
};

export default Modal;

