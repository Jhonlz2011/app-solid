/**
 * Turnstile.tsx — Cloudflare Turnstile widget for SolidJS (Invisible Mode)
 */
import { Component, onMount, onCleanup, createSignal } from 'solid-js';

// Extend Window with Turnstile API
declare global {
  interface Window {
    turnstile?: {
      render: (container: HTMLElement, options: TurnstileOptions) => string;
      reset: (widgetId: string) => void;
      remove: (widgetId: string) => void;
    };
    onloadTurnstileCallback?: () => void;
  }
}

interface TurnstileOptions {
  sitekey: string;
  theme?: 'light' | 'dark' | 'auto';
  size?: 'normal' | 'compact' | 'flexible' | 'invisible';
  language?: string;
  callback?: (token: string) => void;
  'expired-callback'?: () => void;
  'error-callback'?: () => void;
  'before-interactive-callback'?: () => void;
  'after-interactive-callback'?: () => void;
}

export interface TurnstileProps {
  siteKey?: string;
  theme?: 'light' | 'dark' | 'auto';
  onToken: (token: string) => void;
  onExpire?: () => void;
  onError?: () => void;
}

// Singleton: load script only once across component instances
let scriptLoaded = false;
let scriptLoading = false;
const pendingCallbacks: (() => void)[] = [];
const pendingErrorCallbacks: (() => void)[] = [];

function loadTurnstileScript(onReady: () => void, onError: () => void) {
  if (typeof window === 'undefined') return;

  if (scriptLoaded && window.turnstile) {
    onReady();
    return;
  }

  pendingCallbacks.push(onReady);
  pendingErrorCallbacks.push(onError);

  if (scriptLoading) return;
  scriptLoading = true;

  const script = document.createElement('script');
  script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
  script.async = true;
  script.defer = true;

  script.onload = () => {
    scriptLoaded = true;
    scriptLoading = false;
    pendingCallbacks.splice(0).forEach((cb) => cb());
    pendingErrorCallbacks.splice(0);
  };

  script.onerror = () => {
    scriptLoading = false;
    console.error('[Turnstile] Failed to load Cloudflare Turnstile script.');
    pendingErrorCallbacks.splice(0).forEach((cb) => cb());
    pendingCallbacks.splice(0);
  };

  document.head.appendChild(script);
}

const Turnstile: Component<TurnstileProps> = (props) => {
  let containerRef: HTMLDivElement | undefined;
  let widgetId: string | undefined;

  const siteKey = () =>
    props.siteKey ?? import.meta.env.VITE_TURNSTILE_SITE_KEY ?? '';

  const resetWidget = () => {
    if (widgetId && window.turnstile) {
      window.turnstile.reset(widgetId);
    }
  };

  const handleOnline = () => {
    resetWidget();
  };

  onMount(() => {
    if (!siteKey()) {
      console.warn('[Turnstile] No siteKey provided. Bypassing Turnstile for development.');
      props.onToken('dev_bypass_token');
      return;
    }

    window.addEventListener('online', handleOnline);

    loadTurnstileScript(
      () => {
        if (!containerRef || !document.contains(containerRef) || !window.turnstile) return;
        
        widgetId = window.turnstile.render(containerRef, {
          sitekey: siteKey(),
          size: 'invisible', // <-- CLAVE: Fuerza el modo invisible
          theme: props.theme ?? 'auto',
          language: 'es',
          callback: (token: string) => {
            props.onToken(token);
          },
          'expired-callback': () => {
            props.onExpire?.();
            resetWidget(); // Si expira, genera uno nuevo en background automáticamente
          },
          'error-callback': () => {
            props.onError?.();
            resetWidget();
          }
        });
      },
      () => {
        props.onError?.();
      }
    );
  });

  onCleanup(() => {
    window.removeEventListener('online', handleOnline);
    if (widgetId && window.turnstile) {
      window.turnstile.remove(widgetId);
      widgetId = undefined;
    }
  });

  // Retorna un div vacío, sin ocupar espacio en el DOM
  return (
    <div
      ref={containerRef}
      class="hidden" 
      aria-hidden="true"
    />
  );
};

export default Turnstile;