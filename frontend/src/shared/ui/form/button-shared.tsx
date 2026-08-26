import { JSX, Show } from 'solid-js';
import { cn } from '../../lib/utils';
import { SpinnerIcon } from '@icons/SpinnerIcon';

export const BUTTON_VARIANTS = {
  none: "",
  primary: "bg-primary text-on-primary hover:bg-primary/90 transition-all duration-200 border border-transparent shadow-lg shadow-primary/20",
  secondary: "bg-secondary text-on-secondary hover:bg-secondary transition-all duration-200 border border-transparent shadow-lg shadow-secondary/20",
  outline: "bg-transparent border border-border text-text hover:bg-surface hover:border-border-strong active:bg-surface-3 transition-scale duration-200",
  ghost: "bg-transparent text-muted hover:text-heading hover:bg-surface active:bg-surface-3 border border-transparent transition-scale duration-200",
  link: "bg-transparent text-primary hover:text-primary-strong hover:bg-primary-soft transition-colors",
  danger: "bg-danger text-white hover:bg-danger/85 transition-scale duration-200 border border-transparent shadow-lg shadow-danger/20",
  destructive: "bg-destructive text-white hover:bg-destructive/85 transition-scale duration-200 border border-transparent shadow-lg shadow-destructive/30",
  warning: "bg-warning text-white hover:bg-warning/85 transition-scale duration-200 border border-transparent shadow-lg shadow-warning/20",
  success: "bg-success text-white hover:bg-success/85 transition-scale duration-200 border border-transparent shadow-lg shadow-success/20",
};

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



export type ButtonVariant = keyof typeof BUTTON_VARIANTS;
export type ButtonSize = keyof typeof BUTTON_SIZES;
export type ButtonRadius = keyof typeof BUTTON_RADII;

export interface ButtonVariantOptions {
  variant?: ButtonVariant;
  size?: ButtonSize;
  radius?: ButtonRadius;
  fullWidth?: boolean;
  loading?: boolean;
  hasLoadingText?: boolean;
  className?: string;
  class?: string;
}

export interface SharedButtonProps {
  variant?: ButtonVariant;
  size?: ButtonSize;
  radius?: ButtonRadius;
  fullWidth?: boolean;
  loading?: boolean;
  loadingText?: JSX.Element | string;
  icon?: JSX.Element;
}

export function buttonVariants(options?: ButtonVariantOptions): string {
  const variant = options?.variant ?? 'primary';
  const size = options?.size ?? 'md';
  const radius = options?.radius ?? 'lg';
  const fullWidth = options?.fullWidth;
  const loading = options?.loading;
  const hasLoadingText = options?.hasLoadingText;

  return cn(
    "inline-flex items-center justify-center hover:brightness-110 active:scale-[0.97] border-b-[4px] hover:border-b-[6px] active:border-b-[2px] active:brightness-90 active:translate-y-[2px] gap-2 font-medium cursor-pointer select-none",
    "outline-hidden focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-1 focus-visible:ring-offset-bg",
    "disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100",
    BUTTON_VARIANTS[variant],
    BUTTON_SIZES[size],
    BUTTON_RADII[radius],
    fullWidth && 'w-full',
    (loading && !hasLoadingText) && 'relative text-transparent! transition-none hover:text-transparent!',
    options?.className,
    options?.class
  );
}

export function getButtonClasses(params: {
  variant: ButtonVariant;
  size: ButtonSize;
  radius: ButtonRadius;
  fullWidth?: boolean;
  loading?: boolean;
  loadingText?: JSX.Element | string;
  className?: string;
  class?: string;
}) {
  return buttonVariants({
    variant: params.variant,
    size: params.size,
    radius: params.radius,
    fullWidth: params.fullWidth,
    loading: params.loading,
    hasLoadingText: Boolean(params.loadingText),
    className: params.className,
    class: params.class,
  });
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
