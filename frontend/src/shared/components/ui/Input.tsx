import { JSX } from 'solid-js';

interface InputProps extends JSX.InputHTMLAttributes<HTMLInputElement> {
  label: string;
}

export default function Input(props: InputProps) {
  return (
    <div class="flex flex-col gap-1 w-full">
      <label for={props.id} class="text-sm font-medium text-muted">
        {props.label}
      </label>
      <input
        {...props}
        class={`input-control ${props.class ?? ''}`}
      />
    </div>
  );
}
