import { JSX, Show } from 'solid-js';
import { cn } from '../../lib/utils';
import { SpinnerIcon } from '@icons/SpinnerIcon';

export const TACTILE_3D_VARIANTS: Set<string> = new Set([
  'primary',
  'secondary',
  'outline',
  'danger',
  'destructive',
  'warning',
  'success',
]);

/** Base pedestal colors (outer container) */
export const BUTTON_BASE_VARIANTS: Record<string, string> = {
  none: "",
  primary: "bg-primary-edge",
  secondary: "bg-secondary-edge",
  outline: "bg-outline-edge",
  danger: "bg-danger-edge",
  destructive: "bg-destructive-edge",
  warning: "bg-warning-edge",
  success: "bg-success-edge",
  ghost: "bg-transparent",
  link: "bg-transparent",
};

/** Surface face colors (inner floating layer) */
export const BUTTON_SURFACE_VARIANTS: Record<string, string> = {
  none: "",
  primary: "bg-primary text-on-primary shadow-sm shadow-primary/20",
  secondary: "bg-secondary text-on-secondary shadow-sm shadow-secondary/20",
  outline: "bg-card text-text border border-border hover:bg-surface",
  danger: "bg-danger text-white shadow-sm shadow-danger/20",
  destructive: "bg-destructive text-white shadow-sm shadow-destructive/30",
  warning: "bg-warning text-white shadow-sm shadow-warning/20",
  success: "bg-success text-white shadow-sm shadow-success/20",
  ghost: "bg-transparent text-muted hover:text-heading hover:bg-surface active:bg-surface-3 transition-colors active:scale-[0.98]",
  link: "bg-transparent text-primary hover:text-primary-strong hover:underline transition-colors p-0 h-auto",
};

// Backward compatibility map
export const BUTTON_VARIANTS = BUTTON_SURFACE_VARIANTS;

export const BUTTON_SIZES = {
  sm: "h-8 px-3 text-xs",
  md: "h-9.5 px-4 text-sm",
  lg: "h-12 px-5 text-base",
  icon: "h-10 w-10 p-0",
  icon_md: "h-8 w-8 p-0",
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

export type ButtonVariant = keyof typeof BUTTON_SURFACE_VARIANTS;
export type ButtonSize = keyof typeof BUTTON_SIZES;
export type ButtonRadius = keyof typeof BUTTON_RADII;

export interface SharedButtonProps {
  variant?: ButtonVariant;
  size?: ButtonSize;
  radius?: ButtonRadius;
  /** Explicitly enables or disables 3D tactile mode with pedestal and extrusion */
  tactile?: boolean;
  /** Syntactic sugar for `tactile={false}` (renders as clean single-layer flat button) */
  flat?: boolean;
  fullWidth?: boolean;
  loading?: boolean;
  loadingText?: JSX.Element | string;
  icon?: JSX.Element;
}

export interface ButtonVariantOptions extends SharedButtonProps {
  className?: string;
  class?: string;
  hasLoadingText?: boolean;
}

/** Determines whether a button should render in 3D tactile mode */
export function isButton3D(options?: { variant?: ButtonVariant; tactile?: boolean; flat?: boolean }): boolean {
  if (options?.flat === true || options?.tactile === false) return false;
  if (options?.tactile === true) return true;
  return TACTILE_3D_VARIANTS.has(options?.variant ?? 'primary');
}

/** Outer button base class (Static 3D pedestal) */
export function buttonBaseClasses(options?: ButtonVariantOptions): string {
  const variant = options?.variant ?? 'primary';
  const radius = options?.radius ?? 'lg';
  const fullWidth = options?.fullWidth;
  const is3D = isButton3D(options);

  return cn(
    "relative inline-flex items-center justify-center p-0 border-0 cursor-pointer select-none group font-semibold",
    "outline-hidden focus-visible:outline-none",
    "disabled:opacity-50 disabled:cursor-not-allowed",
    is3D ? BUTTON_BASE_VARIANTS[variant] : "bg-transparent",
    BUTTON_RADII[radius],
    fullWidth && 'w-full',
    options?.className,
    options?.class
  );
}

/** Inner button surface class (Pushable surface face) */
export function buttonSurfaceClasses(options?: ButtonVariantOptions): string {
  const variant = options?.variant ?? 'primary';
  const size = options?.size ?? 'md';
  const radius = options?.radius ?? 'lg';
  const fullWidth = options?.fullWidth;
  const loading = options?.loading;
  const hasLoadingText = options?.hasLoadingText;
  const is3D = isButton3D(options);

  return cn(
    "w-full h-full inline-flex items-center justify-center gap-2 font-semibold select-none",
    "focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-1 focus-visible:ring-offset-bg",
    BUTTON_RADII[radius],
    BUTTON_SIZES[size],
    BUTTON_SURFACE_VARIANTS[variant],
    is3D && [
      "-translate-y-[3px] transition-transform duration-100 ease-out",
      "group-hover:-translate-y-[4.5px]",
      "group-active:translate-y-0",
      "group-disabled:translate-y-0",
    ],
    fullWidth && 'w-full',
    (loading && !hasLoadingText) && 'relative text-transparent! transition-none hover:text-transparent!'
  );
}

/** Legacy / Single-Element helper (e.g. for Dropdown triggers or flat variants) */
export function buttonVariants(options?: ButtonVariantOptions): string {
  const variant = options?.variant ?? 'primary';
  const is3D = isButton3D(options);

  if (!is3D) {
    const size = options?.size ?? 'md';
    const radius = options?.radius ?? 'lg';
    const fullWidth = options?.fullWidth;

    return cn(
      "inline-flex items-center justify-center gap-2 font-semibold cursor-pointer select-none active:scale-[0.98]",
      "outline-hidden focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-1 focus-visible:ring-offset-bg",
      "disabled:opacity-50 disabled:cursor-not-allowed",
      BUTTON_SURFACE_VARIANTS[variant],
      BUTTON_SIZES[size],
      BUTTON_RADII[radius],
      fullWidth && 'w-full',
      options?.className,
      options?.class
    );
  }

  return cn(
    buttonBaseClasses(options),
    buttonSurfaceClasses(options)
  );
}

export function getButtonClasses(params: ButtonVariantOptions) {
  return buttonVariants(params);
}

export interface ButtonContentProps {
  loading?: boolean;
  loadingText?: JSX.Element | string;
  icon?: JSX.Element;
  children?: JSX.Element;
}

export function ButtonContent(props: ButtonContentProps) {
  return (
    <Show
      when={props.loading}
      fallback={
        <>
          <Show when={props.icon}>
            <span class="shrink-0">{props.icon}</span>
          </Show>
          {props.children}
        </>
      }
    >
      <Show
        when={props.loadingText}
        fallback={
          <>
            <div class="absolute inset-0 flex items-center justify-center">
              <SpinnerIcon class="size-5 text-current" />
            </div>
            <span class="invisible">{props.children}</span>
          </>
        }
      >
        <div class="flex items-center justify-center gap-2">
          <SpinnerIcon class="size-4 text-current" />
          <Show when={typeof props.loadingText === 'string'} fallback={props.loadingText}>
            <span>{props.loadingText}</span>
          </Show>
        </div>
      </Show>
    </Show>
  );
}
