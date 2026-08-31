import { JSX, splitProps, mergeProps } from 'solid-js';
import { 
  buttonBaseClasses,
  buttonSurfaceClasses,
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
    'fullWidth', 
    'loading', 
    'loadingText', 
    'class', 
    'children', 
    'icon', 
    'disabled'
  ]);

  const baseClasses = () => buttonBaseClasses({
    variant: local.variant,
    radius: local.radius,
    fullWidth: local.fullWidth,
    class: local.class
  });

  const surfaceClasses = () => buttonSurfaceClasses({
    variant: local.variant,
    size: local.size,
    radius: local.radius,
    fullWidth: local.fullWidth,
    loading: local.loading,
    hasLoadingText: Boolean(local.loadingText),
  });

  return (
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
  );
}
