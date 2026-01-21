import { ParentComponent, createContext, createEffect, createSignal, useContext } from 'solid-js';

type Theme = 'light' | 'dark';

interface ThemeContextValue {
  theme: () => Theme;
  toggleTheme: () => void;
  setTheme: (theme: Theme) => void;
}

const ThemeContext = createContext<ThemeContextValue>();

const THEME_STORAGE_KEY = 'app-theme';

const getSystemTheme = (): Theme => {
  if (typeof window === 'undefined') return 'dark';
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
};

const getInitialTheme = (): Theme => {
  if (typeof window === 'undefined') return 'dark';
  const stored = window.localStorage.getItem(THEME_STORAGE_KEY) as Theme | null;
  if (stored === 'light' || stored === 'dark') return stored;
  return getSystemTheme();
};

const applyTheme = (value: Theme) => {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;

  // Set data attribute for tracking
  root.dataset.theme = value;

  // Set CSS color-scheme property to enable light-dark()
  root.style.colorScheme = value;
};

export const ThemeProvider: ParentComponent = (props) => {
  const [theme, setThemeSignal] = createSignal<Theme>(getInitialTheme());

  const persistTheme = (value: Theme) => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(THEME_STORAGE_KEY, value);
  };

  const setTheme = (newTheme: Theme) => {
    setThemeSignal(newTheme);
    persistTheme(newTheme);
    applyTheme(newTheme);
  };

  const toggleTheme = () => {
    setTheme(theme() === 'light' ? 'dark' : 'light');
  };

  // Apply theme on mount/initial load
  createEffect(() => {
    applyTheme(theme());
  });

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, setTheme }}>
      {props.children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within ThemeProvider');
  }
  return context;
};


