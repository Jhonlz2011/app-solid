import { JSX, Show } from 'solid-js';
import { cn } from '../../lib/utils';
import { SpinnerIcon } from '@icons/SpinnerIcon';

export const BUTTON_VARIANTS = {
  none: "",
  primary: "bg-primary text-on-primary border-b-primary-edge shadow-sm shadow-primary/20",
  secondary: "bg-secondary text-on-secondary border-b-secondary-edge shadow-sm shadow-secondary/20",
  outline: "bg-card text-text border border-border border-b-[4px] border-b-outline-edge shadow-xs hover:bg-surface",
  ghost: "bg-transparent text-muted hover:text-heading hover:bg-surface active:bg-surface-3 border-transparent border-b-0 transition-colors active:scale-[0.98] hover:translate-y-0 active:translate-y-0 hover:border-b-0 active:border-b-0",
  link: "bg-transparent text-primary hover:text-primary-strong hover:underline transition-colors p-0 h-auto border-b-0 hover:translate-y-0 active:translate-y-0 hover:border-b-0 active:border-b-0",
  danger: "bg-danger text-white border-b-danger-edge shadow-sm shadow-danger/20",
  destructive: "bg-destructive text-white border-b-destructive-edge shadow-sm shadow-destructive/30",
  warning: "bg-warning text-white border-b-warning-edge shadow-sm shadow-warning/20",
  success: "bg-success text-white border-b-success-edge shadow-sm shadow-success/20",
};

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
    "inline-flex items-center justify-center gap-2 font-semibold cursor-pointer select-none transition-all duration-150 ease-out",
    "border-b-[4px] hover:-translate-y-[1.5px] hover:border-b-[5.5px] hover:brightness-105 active:translate-y-[2.5px] active:border-b-[1.5px] active:brightness-95",
    "outline-hidden focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-1 focus-visible:ring-offset-bg",
    "disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none disabled:border-b-[3px] disabled:brightness-100 disabled:shadow-none",
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
