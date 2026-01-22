import { JSX, splitProps, Show, mergeProps } from 'solid-js';

// 1. Definimos las variantes fuera del componente para evitar recrearlas en cada render
// Usamos Tailwind v4 con variables semánticas (asegúrate de tenerlas en tu @theme)
const VARIANTS = {
  primary: "bg-primary text-on-primary hover:bg-primary/90 active:scale-[0.98] border border-transparent shadow-sm",
  outline: "bg-transparent border border-border text-text hover:bg-surface-2 hover:border-border-strong active:bg-surface-3",
  ghost: "bg-transparent text-text hover:bg-surface-2 active:bg-surface-3 border border-transparent",
  danger: "bg-red-600 text-white hover:bg-red-700 active:scale-[0.98] border border-transparent shadow-sm"
};

const SIZES = {
  sm: "h-8 px-3 text-xs",
  md: "h-10 px-4 text-sm",
  lg: "h-12 px-6 text-base"
};

type ButtonVariant = keyof typeof VARIANTS;
type ButtonSize = keyof typeof SIZES;

interface ButtonProps extends JSX.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  fullWidth?: boolean;
  loading?: boolean;
  icon?: JSX.Element; // Slot opcional para iconos
}

export default function Button(props: ButtonProps) {
  // 2. Usamos mergeProps para defaults seguros sin undefined
  const merged = mergeProps({ variant: 'primary' as ButtonVariant, size: 'md' as ButtonSize, type: "button" as const }, props);

  // 3. Separamos props para pasar 'others' al elemento nativo
  const [local, others] = splitProps(merged, [
    'variant',
    'size',
    'fullWidth',
    'loading',
    'class',
    'children',
    'icon',
    'disabled'
  ]);

  return (
    <button
      {...others}
      disabled={local.disabled || local.loading}
      // 4. Clase Base Estática (Renderizado instantáneo)
      class={`
        inline-flex items-center justify-center gap-2 rounded-lg font-medium 
        transition-all duration-200 cursor-pointer
        outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-1
        disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100
        ${VARIANTS[local.variant]} 
        ${SIZES[local.size]} 
        ${local.class || ''}
      `}
      // 5. classList para estados booleanos (Optimización de SolidJS)
      classList={{
        'w-full': local.fullWidth,
        'relative text-transparent transition-none hover:text-transparent': local.loading // Hack visual para mantener el ancho del botón mientras carga
      }}
    >
      {/* 6. Manejo de Loading inteligente (Overlay absoluto para no mover el layout) */}
      <Show when={local.loading}>
        <div class="absolute inset-0 flex items-center justify-center">
          {/* Spinner SVG optimizado - usa text-on-primary para ser visible sobre el botón */}
          <svg class="animate-spin size-5 text-on-primary" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
        </div>
      </Show>

      {/* Renderizado de Icono opcional */}
      <Show when={local.icon && !local.loading}>
        <span class="shrink-0">{local.icon}</span>
      </Show>

      {/* Contenido (Hijo) */}
      <span class={local.loading ? "invisible" : ""}>
        {local.children}
      </span>
    </button>
  );
}