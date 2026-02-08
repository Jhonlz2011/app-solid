import { JSX, Show } from 'solid-js';

interface InputProps extends JSX.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export default function Input(props: InputProps) {
  return (
    <div class="flex flex-col gap-1 w-full">
      <Show when={props.label}>
        <label for={props.id} class="text-sm font-medium text-muted">
          {props.label}
        </label>
      </Show>
      <input
        {...props}
        class={`bg-card-alt border text-text rounded-2xl px-4 py-3 transition-all duration-200 
          ${props.error ? 'border-red-500/50 focus:ring-red-500/25' : 'border-border focus:border-primary/65 focus:ring-primary/25'}
          focus:ring-2 outline-none ${props.class ?? ''}`}
      />
      <div class="min-h-4">
        <Show when={props.error}>
          <p class="text-xs text-red-500 font-medium ml-1 animate-in fade-in slide-in-from-top-1 duration-200">
            {props.error}
          </p>
        </Show>
      </div>
    </div>
  );
}
