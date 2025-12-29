import { JSX, splitProps } from 'solid-js';

type ButtonVariant = 'primary' | 'outline' | 'ghost' | 'danger';

interface ButtonProps extends JSX.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  fullWidth?: boolean;
}

const variantClasses: Record<ButtonVariant, string> = {
  primary: 'btn btn-primary',
  outline: 'btn btn-outline',
  ghost: 'btn btn-ghost',
  danger: 'btn button-danger',
};

export default function Button(props: ButtonProps) {
  const [local, others] = splitProps(props, ['class', 'children', 'variant', 'fullWidth']);
  const variant = local.variant ?? 'primary';
  const widthClass = local.fullWidth === false ? '' : 'w-full';
  const baseClass = `${variantClasses[variant]} disabled:opacity-50 disabled:cursor-not-allowed`;
  const combinedClass = [baseClass, widthClass, local.class].filter(Boolean).join(' ').trim();

  return (
    <button
      {...others}
      class={combinedClass}
    >
      {local.children}
    </button>
  );
}
