import { JSX, splitProps, mergeProps } from 'solid-js';
import { 
  getButtonClasses, 
  ButtonContent,
  type ButtonVariant, 
  type ButtonSize, 
  type ButtonRadius, 
  type SharedButtonProps 
} from './button-shared';

// Re-export constants and types to prevent breaking existing imports in the codebase
export { 
  BUTTON_VARIANTS, 
  BUTTON_SIZES, 
  BUTTON_RADII,
  type ButtonVariant,
  type ButtonSize,
  type ButtonRadius
} from './button-shared';

export type ButtonProps = JSX.ButtonHTMLAttributes<HTMLButtonElement> & SharedButtonProps;

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

  const buttonClasses = () => getButtonClasses({
    variant: local.variant,
    size: local.size,
    radius: local.radius,
    fullWidth: local.fullWidth,
    loading: local.loading,
    loadingText: local.loadingText,
    className: local.class
  });

  return (
    <button
      {...others}
      disabled={local.disabled || local.loading}
      class={buttonClasses()}
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
  );
}
