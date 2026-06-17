/**
 * Turnstile.tsx — Cloudflare Turnstile widget for SolidJS
 *
 * Loads the CF script once per page and renders the widget inside a div ref.
 * Exposes the token via onToken() callback.
 *
 * Usage:
 *   <Turnstile onToken={(token) => setTurnstileToken(token)} onExpire={() => setTurnstileToken(null)} />
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
    // Called by CF script on ready — we override if needed
    onloadTurnstileCallback?: () => void;
  }
}

interface TurnstileOptions {
  sitekey: string;
  theme?: 'light' | 'dark' | 'auto';
  size?: 'normal' | 'compact' | 'flexible';
  language?: string;
  callback?: (token: string) => void;
  'expired-callback'?: () => void;
  'error-callback'?: () => void;
  'before-interactive-callback'?: () => void;
  'after-interactive-callback'?: () => void;
}

export interface TurnstileProps {
  /** Cloudflare site key. Defaults to VITE_TURNSTILE_SITE_KEY env var. */
  siteKey?: string;
  /** Widget color theme. Default: 'auto' (follows system/page preference). */
  theme?: 'light' | 'dark' | 'auto';
  /** Called when CF issues a valid token. */
  onToken: (token: string) => void;
  /** Called when token expires (~5 min). Reset token to null here. */
  onExpire?: () => void;
  /** Called on CF challenge error. */
  onError?: () => void;
}

// Singleton: load script only once across component instances
let scriptLoaded = false;
let scriptLoading = false;
const pendingCallbacks: (() => void)[] = [];

function loadTurnstileScript(onReady: () => void) {
  if (typeof window === 'undefined') return;

  if (scriptLoaded && window.turnstile) {
    onReady();
    return;
  }

  pendingCallbacks.push(onReady);

  if (scriptLoading) return;
  scriptLoading = true;

  const script = document.createElement('script');
  script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
  script.async = true;
  script.defer = true;

  script.onload = () => {
    scriptLoaded = true;
    scriptLoading = false;
    // Flush all pending callbacks
    pendingCallbacks.splice(0).forEach((cb) => cb());
  };

  script.onerror = () => {
    scriptLoading = false;
    console.error('[Turnstile] Failed to load Cloudflare Turnstile script.');
  };

  document.head.appendChild(script);
}

const Turnstile: Component<TurnstileProps> = (props) => {
  let containerRef: HTMLDivElement | undefined;
  let widgetId: string | undefined;

  const siteKey = () =>
    props.siteKey ?? import.meta.env.VITE_TURNSTILE_SITE_KEY ?? '';

  onMount(() => {
    if (!siteKey()) {
      console.warn('[Turnstile] No siteKey provided. Set VITE_TURNSTILE_SITE_KEY in your .env file.');
      return;
    }

    loadTurnstileScript(() => {
      if (!containerRef || !window.turnstile) return;
      widgetId = window.turnstile.render(containerRef, {
        sitekey: siteKey(),
        theme: props.theme ?? 'auto',
        language: 'es',
        callback: (token: string) => props.onToken(token),
        'expired-callback': () => props.onExpire?.(),
        'error-callback': () => props.onError?.(),
      });
    });
  });

  onCleanup(() => {
    if (widgetId && window.turnstile) {
      window.turnstile.remove(widgetId);
      widgetId = undefined;
    }
  });

  return (
    <div
      ref={containerRef}
      class="flex justify-center mt-1"
      aria-label="Verificación de seguridad Cloudflare"
    />
  );
};

export default Turnstile;
