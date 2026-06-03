import { JSX, Show } from 'solid-js';
import { cn } from '../lib/utils';

export const BUTTON_VARIANTS = {
  primary: "bg-primary text-on-primary hover:bg-primary/90 active:scale-[0.97] transition-all duration-200 border border-transparent shadow-lg shadow-primary/20",
  secondary: "bg-secondary text-on-secondary hover:bg-secondary active:scale-[0.97] transition-all duration-200 border border-transparent shadow-lg shadow-secondary/20",
  outline: "bg-transparent border border-border text-text hover:bg-surface hover:border-border-strong active:bg-surface-3 active:scale-[0.97] transition-all duration-200",
  ghost: "bg-transparent text-muted hover:text-heading hover:bg-surface active:bg-surface-3 border border-transparent transition-all duration-200 active:scale-[0.97]",
  link: "bg-transparent text-primary hover:text-primary-strong hover:bg-primary-soft transition-colors",
  danger: "bg-danger text-white hover:bg-danger/85 active:scale-[0.97] transition-all duration-200 border border-transparent shadow-lg shadow-danger/20",
  destructive: "bg-destructive text-white hover:bg-destructive/85 active:scale-[0.97] transition-all duration-200 border border-transparent shadow-lg shadow-destructive/30",
  warning: "bg-warning text-white hover:bg-warning/85 active:scale-[0.97] transition-all duration-200 border border-transparent shadow-lg shadow-warning/20",
  success: "bg-success text-white hover:bg-success/85 active:scale-[0.97] transition-all duration-200 border border-transparent shadow-lg shadow-success/20",
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

export interface SharedButtonProps {
  variant?: ButtonVariant;
  size?: ButtonSize;
  radius?: ButtonRadius;
  fullWidth?: boolean;
  loading?: boolean;
  loadingText?: JSX.Element;
  icon?: JSX.Element;
}

export function getButtonClasses(params: {
  variant: ButtonVariant;
  size: ButtonSize;
  radius: ButtonRadius;
  fullWidth?: boolean;
  loading?: boolean;
  loadingText?: any;
  className?: string;
}) {
  return cn(
    "inline-flex items-center justify-center gap-2 font-medium cursor-pointer select-none",
    "outline-hidden focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-1 focus-visible:ring-offset-bg",
    "disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100",
    BUTTON_VARIANTS[params.variant],
    BUTTON_SIZES[params.size],
    BUTTON_RADII[params.radius],
    params.fullWidth && 'w-full',
    (params.loading && !params.loadingText) && 'relative text-transparent! transition-none hover:text-transparent!',
    params.className
  );
}

export interface ButtonContentProps {
  loading?: boolean;
  loadingText?: JSX.Element;
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
              <svg class="animate-spin size-5 text-current" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
            </div>
            <span class="invisible">{props.children}</span>
          </>
        }
      >
        <div class="flex items-center justify-center gap-2">
          <svg class="animate-spin size-4 text-current" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          <Show when={typeof props.loadingText === 'string'} fallback={props.loadingText}>
            <span>{props.loadingText}</span>
          </Show>
        </div>
      </Show>
    </Show>
  );
}
