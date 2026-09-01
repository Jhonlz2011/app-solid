import { JSX, splitProps, mergeProps, Show } from 'solid-js';
import { 
  buttonBaseClasses,
  buttonSurfaceClasses,
  buttonVariants,
  isButton3D,
  ButtonContent,
  type ButtonVariant, 
  type ButtonSize, 
  type ButtonRadius, 
  type SharedButtonProps,
} from '@form/button-shared';

export interface ButtonProps extends JSX.ButtonHTMLAttributes<HTMLButtonElement>, SharedButtonProps {}

export default function Button(props: ButtonProps) {
  const merged = mergeProps({ 
    variant: 'primary' as ButtonVariant, 
    size: 'md' as ButtonSize, 
    radius: 'lg' as ButtonRadius, 
    type: "button" as const 
  }, props);

  const [local, others] = splitProps(merged, [
    'variant', 
    'size', 
    'radius', 
    'tactile',
    'flat',
    'fullWidth', 
    'loading', 
    'loadingText', 
    'class', 
    'children', 
    'icon', 
    'disabled'
  ]);

  const is3D = () => isButton3D({ variant: local.variant, tactile: local.tactile, flat: local.flat });

  const flatClasses = () => buttonVariants({
    variant: local.variant,
    size: local.size,
    radius: local.radius,
    fullWidth: local.fullWidth,
    loading: local.loading,
    hasLoadingText: Boolean(local.loadingText),
    class: local.class,
    tactile: false,
  });

  const baseClasses = () => buttonBaseClasses({
    variant: local.variant,
    radius: local.radius,
    fullWidth: local.fullWidth,
    tactile: true,
    class: local.class
  });

  const surfaceClasses = () => buttonSurfaceClasses({
    variant: local.variant,
    size: local.size,
    radius: local.radius,
    fullWidth: local.fullWidth,
    loading: local.loading,
    hasLoadingText: Boolean(local.loadingText),
    tactile: true,
  });

  return (
    <Show
      when={is3D()}
      fallback={
        <button
          {...others}
          disabled={local.disabled || local.loading}
          class={flatClasses()}
          aria-busy={local.loading}
          aria-disabled={local.disabled || local.loading}
        >
          <ButtonContent
            loading={local.loading}
            loadingText={local.loadingText}
            icon={local.icon}
          >
            {local.children}
          </ButtonContent>
        </button>
      }
    >
      <button
        {...others}
        disabled={local.disabled || local.loading}
        class={baseClasses()}
        aria-busy={local.loading}
        aria-disabled={local.disabled || local.loading}
      >
        <span class={surfaceClasses()}>
          <ButtonContent
            loading={local.loading}
            loadingText={local.loadingText}
            icon={local.icon}
          >
            {local.children}
          </ButtonContent>
        </span>
      </button>
    </Show>
  );
}

