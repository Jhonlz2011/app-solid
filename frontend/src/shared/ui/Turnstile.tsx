/**
 * Turnstile.tsx — Cloudflare Turnstile widget for SolidJS (2026 On-Demand Standard)
 *
 * Uses explicit rendering + execution:'execute' + appearance:'interaction-only':
 * - Forms stay immediately interactive (no blocking spinner on mount)
 * - Script & widget pre-warm silently in the background
 * - Fresh token is generated just-in-time on submit via handle.getToken()
 */
import { Component, onMount, onCleanup } from 'solid-js';
import { getTurnstileSiteKey } from '../config/runtime-env';

declare global {
  interface Window {
    turnstile?: {
      render: (container: HTMLElement, options: TurnstileOptions) => string;
      execute: (widgetId: string) => void;
      reset: (widgetId: string) => void;
      remove: (widgetId: string) => void;
    };
  }
}

interface TurnstileOptions {
  sitekey: string;
  action?: string;
  execution?: 'render' | 'execute';
  appearance?: 'always' | 'execute' | 'interaction-only';
  retry?: 'auto' | 'never';
  'refresh-expired'?: 'auto' | 'manual' | 'never';
  'refresh-timeout'?: 'auto' | 'manual' | 'never';
  theme?: 'light' | 'dark' | 'auto';
  language?: string;
  callback?: (token: string) => void;
  'expired-callback'?: () => void;
  'timeout-callback'?: () => void;
  'unsupported-callback'?: () => void;
  'error-callback'?: (errorCode?: string | number) => boolean | void;
  'before-interactive-callback'?: () => void;
}

export interface TurnstileHandle {
  getToken: () => Promise<string>;
  reset: () => void;
}

export interface TurnstileProps {
  siteKey?: string;
  action?: string;
  theme?: 'light' | 'dark' | 'auto';
  ref?: (handle: TurnstileHandle) => void;
  class?: string;
}

const SCRIPT_SRC = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
const NON_INTERACTIVE_TIMEOUT_MS = 15_000;
const INTERACTIVE_TIMEOUT_MS = 60_000;

let scriptPromise: Promise<void> | null = null;

function describeTurnstileError(code?: string | number): string {
  const c = String(code ?? '');
  if (c === '110100' || c === '110110' || c === '400020') {
    return 'Configuración de verificación de seguridad inválida.';
  }
  if (c === '110200') {
    return 'Dominio no autorizado para la verificación de seguridad.';
  }
  if (c === '110600' || c === '110620') {
    return 'La verificación de seguridad expiró. Inténtalo de nuevo.';
  }
  if (c === '200100') {
    return 'Verifica la fecha y hora de tu dispositivo e inténtalo de nuevo.';
  }
  if (c === '200500') {
    return 'No se pudo cargar la verificación de seguridad. Revisa tu conexión o bloqueador de contenido.';
  }
  return 'No se pudo completar la verificación de seguridad. Inténtalo de nuevo.';
}

function loadTurnstileScript(): Promise<void> {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('Turnstile solo está disponible en el navegador.'));
  }
  if (window.turnstile) return Promise.resolve();
  if (scriptPromise) return scriptPromise;

  scriptPromise = new Promise<void>((resolve, reject) => {
    const script = document.createElement('script');
    script.src = SCRIPT_SRC;
    script.async = true;
    script.defer = true;

    script.onload = () => {
      if (window.turnstile) {
        resolve();
      } else {
        script.remove();
        scriptPromise = null;
        reject(new Error(describeTurnstileError('200500')));
      }
    };

    script.onerror = () => {
      script.remove();
      scriptPromise = null;
      console.warn('[Turnstile] Failed to load Cloudflare Turnstile script.');
      reject(new Error(describeTurnstileError('200500')));
    };

    document.head.appendChild(script);
  });

  return scriptPromise;
}

const Turnstile: Component<TurnstileProps> = (props) => {
  let containerRef: HTMLDivElement | undefined;
  let widgetId: string | undefined;
  let executedOnce = false;
  let pending: {
    resolve: (token: string) => void;
    reject: (err: Error) => void;
    timer: ReturnType<typeof setTimeout>;
  } | null = null;

  const siteKey = () => (props.siteKey ?? getTurnstileSiteKey()).trim();

  const clearPending = () => {
    if (pending) {
      clearTimeout(pending.timer);
      pending = null;
    }
  };

  const settleResolve = (token: string) => {
    const current = pending;
    clearPending();
    current?.resolve(token);
  };

  const settleReject = (err: Error) => {
    const current = pending;
    clearPending();
    current?.reject(err);
  };

  const ensureRendered = async (): Promise<string> => {
    const key = siteKey();
    if (!key) {
      throw new Error('La verificación de seguridad no está configurada en este entorno.');
    }

    await loadTurnstileScript();

    if (!containerRef || !document.contains(containerRef) || !window.turnstile) {
      throw new Error('La verificación de seguridad no está disponible.');
    }

    if (!widgetId) {
      widgetId = window.turnstile.render(containerRef, {
        sitekey: key,
        action: props.action ?? 'login',
        execution: 'execute',
        appearance: 'interaction-only',
        retry: 'auto',
        'refresh-expired': 'auto',
        'refresh-timeout': 'auto',
        theme: props.theme ?? 'auto',
        language: 'es',
        callback: (token: string) => settleResolve(token),
        'before-interactive-callback': () => {
          if (pending) {
            clearTimeout(pending.timer);
            pending.timer = setTimeout(() => {
              executedOnce = true;
              settleReject(new Error(describeTurnstileError('110600')));
            }, INTERACTIVE_TIMEOUT_MS);
          }
        },
        'expired-callback': () => {
          executedOnce = true;
        },
        'timeout-callback': () => {
          executedOnce = true;
          settleReject(new Error(describeTurnstileError('110600')));
        },
        'unsupported-callback': () => {
          settleReject(new Error('Tu navegador no es compatible con la verificación de seguridad.'));
        },
        'error-callback': (errorCode?: string | number) => {
          executedOnce = true;
          console.warn(`[Turnstile] Error code: ${errorCode ?? 'unknown'}`);
          settleReject(new Error(describeTurnstileError(errorCode)));
          return true;
        },
      });
    }

    return widgetId;
  };

  const reset = () => {
    clearPending();
    if (widgetId && window.turnstile) {
      window.turnstile.reset(widgetId);
      executedOnce = false;
    }
  };

  const getToken = async (): Promise<string> => {
    if (!siteKey()) {
      if (import.meta.env.DEV) return 'dev_bypass_token';
      throw new Error('La verificación de seguridad no está configurada en este entorno.');
    }

    const id = await ensureRendered();
    clearPending();

    if (executedOnce) {
      window.turnstile!.reset(id);
    }
    executedOnce = true;

    return new Promise<string>((resolve, reject) => {
      const timer = setTimeout(() => {
        settleReject(new Error(describeTurnstileError('110600')));
      }, NON_INTERACTIVE_TIMEOUT_MS);

      pending = { resolve, reject, timer };
      window.turnstile!.execute(id);
    });
  };

  onMount(() => {
    props.ref?.({ getToken, reset });

    // Pre-warm script & widget silently in the background (zero UI blocking)
    if (siteKey()) {
      void ensureRendered().catch(() => {});
    }
  });

  onCleanup(() => {
    clearPending();
    if (widgetId && window.turnstile) {
      window.turnstile.remove(widgetId);
      widgetId = undefined;
    }
  });

  return (
    <div
      ref={containerRef}
      class={`flex justify-center empty:hidden ${props.class || ''}`}
    />
  );
};

export default Turnstile;
