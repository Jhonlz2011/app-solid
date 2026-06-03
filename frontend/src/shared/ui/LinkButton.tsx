import { JSX, splitProps } from 'solid-js';
import { Link, type LinkProps } from '@tanstack/solid-router';
import { 
  getButtonClasses, 
  ButtonContent,
  type SharedButtonProps 
} from './button-shared';

export type LinkButtonProps = LinkProps & SharedButtonProps & JSX.AnchorHTMLAttributes<HTMLAnchorElement>;

export default function LinkButton(props: LinkButtonProps) {
  // Separamos las propiedades exclusivas del botón de las del Link / Anchor HTML
  const [local, linkProps] = splitProps(props, [
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

  const buttonClasses = () => getButtonClasses({
    variant: local.variant ?? 'primary',
    size: local.size ?? 'md',
    radius: local.radius ?? 'lg',
    fullWidth: local.fullWidth,
    loading: local.loading,
    loadingText: local.loadingText,
    className: local.class
  });

  return (
    <Link
      {...(linkProps as any)}
      disabled={local.disabled || local.loading}
      class={buttonClasses()}
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

