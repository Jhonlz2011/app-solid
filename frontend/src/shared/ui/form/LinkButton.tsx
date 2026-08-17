import { JSX, splitProps, mergeProps } from 'solid-js';
import { Link, type LinkProps } from '@tanstack/solid-router';
import { 
  buttonVariants, 
  ButtonContent,
  type ButtonVariant,
  type ButtonSize,
  type ButtonRadius,
  type SharedButtonProps 
} from '@form/button-shared';

export interface LinkButtonProps extends LinkProps, SharedButtonProps, JSX.AnchorHTMLAttributes<HTMLAnchorElement> {}

export default function LinkButton(props: LinkButtonProps) {
  const merged = mergeProps({ 
    variant: 'primary' as ButtonVariant, 
    size: 'md' as ButtonSize, 
    radius: 'lg' as ButtonRadius 
  }, props);

  // Separamos las propiedades exclusivas del botón de las del Link / Anchor HTML
  const [local, linkProps] = splitProps(merged, [
    'variant',
    'size',
    'radius',
    'fullWidth',
    'loading',
    'loadingText',
    'icon',
    'class',
    'disabled',
    'children'
  ]);

  const buttonClasses = () => buttonVariants({
    variant: local.variant,
    size: local.size,
    radius: local.radius,
    fullWidth: local.fullWidth,
    loading: local.loading,
    hasLoadingText: Boolean(local.loadingText),
    class: local.class
  });

  return (
    <Link
      {...(linkProps as any)}
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
    </Link>
  );
}

