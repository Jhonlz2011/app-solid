import { JSX, splitProps, Show, mergeProps } from 'solid-js';
import { cn } from '../lib/utils';

// 1. Definimos las variantes fuera del componente para evitar recrearlas en cada render
// Usamos Tailwind v4 con variables semánticas (asegúrate de tenerlas en tu @theme)
export const BUTTON_VARIANTS = {
  primary: "bg-primary text-on-primary hover:bg-primary/90 active:scale-[0.98] transition-all duration-200 border border-transparent shadow-lg shadow-primary/20",
  secondary: "bg-secondary text-on-secondary hover:bg-secondary/90 active:scale-[0.98] transition-all duration-200 border border-transparent shadow-lg shadow-secondary/20",
  outline: "bg-transparent border border-border text-text hover:bg-surface hover:border-border-strong active:bg-surface-3 transition-all duration-200",
  ghost: "bg-transparent text-muted hover:text-heading hover:bg-surface active:bg-surface-3 border border-transparent transition-colors duration-200",
  danger: "bg-danger text-white hover:bg-danger/85 active:scale-[0.98] transition-all duration-200 border border-transparent shadow-lg shadow-danger/20",
  destructive: "bg-destructive text-white hover:bg-destructive/85 active:scale-[0.98] transition-all duration-200 border border-transparent shadow-lg shadow-destructive/30",
  warning: "bg-warning text-white hover:bg-warning/85 active:scale-[0.98] transition-all duration-200 border border-transparent shadow-lg shadow-warning/20",
  success: "bg-success text-white hover:bg-success/85 active:scale-[0.98] transition-all duration-200 border border-transparent shadow-lg shadow-success/20",
};

/** @deprecated Use BUTTON_VARIANTS */
const VARIANTS = BUTTON_VARIANTS;

export const BUTTON_SIZES = {
  sm: "h-8 px-3 text-xs",
  md: "h-9.5 px-4 text-sm",
  lg: "h-12 px-4 text-base",
  icon: "h-10 w-10 p-0",
  icon_md: "h-8 w-8",
  none: ""  
};

export const BUTTON_RADII = {
  sm: "rounded-sm",
  md: "rounded-md",
  lg: "rounded-lg",
  xl: "rounded-xl",
  full: "rounded-full",
  none: ""
};

type ButtonVariant = keyof typeof BUTTON_VARIANTS;
type ButtonSize = keyof typeof BUTTON_SIZES;
type ButtonRadius = keyof typeof BUTTON_RADII;

interface ButtonProps extends JSX.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  radius?: ButtonRadius;
  fullWidth?: boolean;
  loading?: boolean;
  loadingText?: JSX.Element;
  icon?: JSX.Element; // Slot opcional para iconos
}

export default function Button(props: ButtonProps) {
  // 2. Usamos mergeProps para defaults seguros sin undefined
  const merged = mergeProps({ variant: 'primary' as ButtonVariant, size: 'md' as ButtonSize, radius: 'lg' as ButtonRadius, type: "button" as const }, props);

  // 3. Separamos props para pasar 'others' al elemento nativo
  const [local, others] = splitProps(merged, [
    'variant',
    'size',
    'fullWidth',
    'loading',
    'loadingText',
    'class',
    'children',
    'icon',
    'disabled',
    'radius'
  ]);

  return (
    <button
      {...others}
      disabled={local.disabled || local.loading}
      // 4. Clase Base Estática combinada mediante cn()
      class={cn(
        "inline-flex items-center justify-center gap-2 font-medium cursor-pointer",
        "outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-1 focus-visible:ring-offset-bg",
        "disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100",
        BUTTON_VARIANTS[local.variant],
        BUTTON_SIZES[local.size],
        BUTTON_RADII[local.radius],
        local.class
      )}
      // 5. classList para estados booleanos (Optimización de SolidJS)
      classList={{
        'w-full': local.fullWidth,
        'relative text-transparent transition-none hover:text-transparent': local.loading && !local.loadingText
      }}
    >
      {/* 6. Manejo de Loading inteligente (Overlay absoluto para no mover el layout) */}
      <Show
        when={local.loading}
        fallback={
          // Estado Normal
          <>
            <Show when={local.icon}>
              <span class="shrink-0">{local.icon}</span>
            </Show>
            {local.children}
          </>
        }
      >
        <Show
          when={local.loadingText}
          fallback={
            <>
              <div class="absolute inset-0 flex items-center justify-center">
                <svg class="animate-spin size-5 text-current" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                  <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
              </div>
              <span class="invisible">{local.children}</span>
            </>
          }
        >
          <div class="flex items-center justify-center gap-2">
            <svg class="animate-spin size-4 text-current" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            <Show when={typeof local.loadingText === 'string'} fallback={local.loadingText}>
              <span>{local.loadingText}</span>
            </Show>
          </div>
        </Show>
      </Show>
    </button>
  );
}