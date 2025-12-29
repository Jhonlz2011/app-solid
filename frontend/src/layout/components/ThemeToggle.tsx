import { Component, Match, Switch, createMemo } from 'solid-js';
import { useTheme } from '../../contexts/ThemeContext';

const labels = {
  light: 'Modo claro',
  dark: 'Modo oscuro',
} as const;

type ThemeToggleProps = {
  collapsed?: boolean;
};

export const ThemeToggle: Component<ThemeToggleProps> = (props) => {
  const { theme, toggleTheme } = useTheme();

  const nextThemeLabel = createMemo(() => {
    return theme() === 'light' ? labels.dark : labels.light;
  });

  return (
    <button
      onClick={toggleTheme}
      class="flex items-center justify-center text-muted hover-surface p-2 rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-1 focus-visible:ring-offset-transparent"
      data-collapsed={props.collapsed ? 'true' : 'false'}
      title={`Tema actual: ${labels[theme()]}. Cambiar a ${nextThemeLabel()}`}
      aria-label={`Tema actual: ${labels[theme()]}`}
    >
      <Switch>
        <Match when={theme() === 'light'}>
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364-6.364l-.707.707M6.343 17.657l-.707.707m0-12.728l.707.707M17.657 17.657l.707.707M12 8a4 4 0 100 8 4 4 0 000-8z"
            />
          </svg>
        </Match>
        <Match when={theme() === 'dark'}>
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M20.354 15.354A9 9 0 018.646 3.646 9 9 0 1020.354 15.354z"
            />
          </svg>
        </Match>
      </Switch>
    </button>
  );
};

export default ThemeToggle;

