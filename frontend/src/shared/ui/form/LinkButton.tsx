import { JSX, splitProps, mergeProps } from 'solid-js';
import { Link, type LinkProps } from '@tanstack/solid-router';
import { 
  buttonBaseClasses,
  buttonSurfaceClasses,
  ButtonContent,
  type ButtonVariant,
  type ButtonSize,
  type ButtonRadius,
  type SharedButtonProps 
} from '@form/button-shared';

export interface LinkButtonProps extends LinkProps, SharedButtonProps {
  class?: string;
  className?: string;
  children?: JSX.Element;
}

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
    <Link
      {...(linkProps as any)}
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
    </Link>
  );
}
