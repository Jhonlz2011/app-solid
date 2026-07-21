import { JSX, Show, createSignal, splitProps } from 'solid-js';
import { EyeIcon, EyeOffIcon } from './icons';

interface InputProps extends JSX.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  /** Icon element rendered inside the input on the left */
  leadingIcon?: JSX.Element;
  /** Icon element rendered inside the input on the right (ignored when type="password") */
  trailingIcon?: JSX.Element;
}

export default function Input(props: InputProps) {
  const [local, inputProps] = splitProps(props, [
    'label', 'error', 'leadingIcon', 'trailingIcon', 'class', 'type',
  ]);

  const [showPassword, setShowPassword] = createSignal(false);
  const isPassword = () => local.type === 'password';
  const effectiveType = () => (isPassword() && showPassword() ? 'text' : local.type);
  const hasLeading = () => !!local.leadingIcon;
  const hasTrailing = () => !!local.trailingIcon || isPassword();

  return (
    <div class="flex flex-col gap-1 w-full">
      <Show when={local.label}>
        <label for={inputProps.id as string} class="text-sm font-medium text-muted ml-1">
          {local.label}
        </label>
      </Show>

      <div class="group relative">
        {/* Leading icon */}
        <Show when={hasLeading()}>
          <div class="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted/50 pointer-events-none transition-colors duration-200 group-focus-within:text-primary">
            {local.leadingIcon}
          </div>
        </Show>

        <input
          {...inputProps}
          type={effectiveType()}
          class={`w-full bg-card-alt border text-text rounded-xl outline-none transition-all duration-200 py-3
            ${hasLeading() ? 'pl-11' : 'pl-4'}
            ${hasTrailing() ? 'pr-11' : 'pr-4'}
            ${local.error
              ? 'border-red-500/50 focus:ring-red-500/25'
              : 'border-border hover:border-border-strong focus:border-primary/65 focus:ring-primary/25'}
            focus:ring-2 ${local.class ?? ''}`}
        />

        {/* Password visibility toggle */}
        <Show when={isPassword()}>
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword())}
            class="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-muted/50 hover:text-heading transition-colors duration-200 focus:outline-none cursor-pointer"
            tabIndex={-1}
            aria-label={showPassword() ? 'Ocultar contraseña' : 'Mostrar contraseña'}
          >
            <Show when={showPassword()} fallback={<EyeIcon class="size-[18px]" />}>
              <EyeOffIcon class="size-[18px]" />
            </Show>
          </button>
        </Show>

        {/* Trailing icon (non-password) */}
        <Show when={!isPassword() && local.trailingIcon}>
          <div class="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted/50 pointer-events-none transition-colors duration-200 group-focus-within:text-primary">
            {local.trailingIcon}
          </div>
        </Show>
      </div>

      <div class="min-h-4">
        <Show when={local.error}>
          <p class="text-xs text-red-500 font-medium ml-1 animate-in fade-in slide-in-from-top-1 duration-200">
            {local.error}
          </p>
        </Show>
      </div>
    </div>
  );
}
