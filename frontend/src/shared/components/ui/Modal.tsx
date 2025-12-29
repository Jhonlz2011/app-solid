import { Component, JSX, Show, createEffect, onCleanup } from 'solid-js';
import { Portal } from 'solid-js/web';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: JSX.Element;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}

const Modal: Component<ModalProps> = (props) => {
  const sizeClasses = {
    sm: 'max-w-md',
    md: 'max-w-2xl',
    lg: 'max-w-4xl',
    xl: 'max-w-6xl',
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
            class="fixed inset-0 bg-black/70 backdrop-blur-sm transition-opacity"
            onClick={props.onClose}
          />

          {/* Modal */}
          <div class="flex min-h-full items-center justify-center p-4">
            <div
              class={`relative w-full ${sizeClasses[props.size || 'md']} card-panel rounded-2xl shadow-2xl transform transition-all`}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div class="flex items-center justify-between px-6 py-4 border-b border-surface">
                <h3 class="text-xl font-semibold title-primary">{props.title}</h3>
                <button
                  onClick={props.onClose}
                  class="text-muted hover-surface transition-colors p-2 rounded-lg"
                  aria-label="Cerrar"
                >
                  <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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

