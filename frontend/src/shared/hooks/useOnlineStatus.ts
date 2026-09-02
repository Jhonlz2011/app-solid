import { createSignal } from 'solid-js';
import { onlineManager } from '@tanstack/solid-query';
import { queryClient } from '@shared/lib/queryClient';
import { toast } from 'solid-sonner';
import { getApiUrl } from '@shared/config/runtime-env';

// ─── Estado global ─────────────────────────────────────────────────────────
const [isOnline, setIsOnline] = createSignal(
  typeof navigator !== 'undefined' ? navigator.onLine : true
);

// Grace period: tras reconectar, ignorar intentos de marcar offline por unos segundos
let reconnectGraceUntil = 0;
const GRACE_PERIOD_MS = 5_000;

// Heartbeat: check periódico de conectividad real
let heartbeatTimer: ReturnType<typeof setInterval> | null = null;
const HEARTBEAT_INTERVAL = 15_000; // 15 segundos
const HEARTBEAT_TIMEOUT = 4_000;   // timeout del fetch

let isReconnecting = false;
let lastSyncTime = 0;

export function wasRecentlySynchronized(): boolean {
  return Date.now() - lastSyncTime < 5000;
}

// ─── Funciones internas ────────────────────────────────────────────────────

function getHealthUrl(): string {
  return `${getApiUrl()}/api/health`;
}

/** Realiza un check ligero de conectividad real contra /api/health */
async function checkConnectivity(): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), HEARTBEAT_TIMEOUT);
    const response = await fetch(`${getHealthUrl()}?_t=${Date.now()}`, {
      method: 'GET',
      cache: 'no-store',
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    return response.ok;
  } catch {
    return false;
  }
}

/** Lógica de reconexión atómica: reanudar mutaciones pausadas + una sola invalidación */
function handleReconnect() {
  if (isReconnecting) return;
  if (Date.now() - lastSyncTime < 5000) return; // Debounce 5s

  isReconnecting = true;
  reconnectGraceUntil = Date.now() + GRACE_PERIOD_MS;

  const pausedCount = queryClient
    .getMutationCache()
    .getAll()
    .filter(m => m.state.isPaused).length;

  const completeSync = () => {
    queryClient.invalidateQueries({ refetchType: 'active' });
    lastSyncTime = Date.now();
    isReconnecting = false;
  };

  if (pausedCount > 0) {
    const toastId = toast.loading(
      `Sincronizando ${pausedCount} operación${pausedCount !== 1 ? 'es' : ''} pendiente${pausedCount !== 1 ? 's' : ''}...`
    );
    queryClient.resumePausedMutations().then(() => {
      completeSync();
      toast.success('Todo sincronizado correctamente', { id: toastId, duration: 3000 });
    }).catch(() => {
      completeSync();
      toast.error('Algunas operaciones no pudieron sincronizarse', { id: toastId, duration: 5000 });
    });
  } else {
    completeSync();
  }
}

/** Marca el sistema como online */
function markOnline() {
  if (isOnline()) return; // ya estaba online
  setIsOnline(true);
  onlineManager.setOnline(true);
  handleReconnect();
  stopHeartbeat(); // parar heartbeat, ya estamos online
}

/** Marca el sistema como offline */
function markOffline() {
  if (!isOnline()) return; // ya estaba offline
  reconnectGraceUntil = 0;
  setIsOnline(false);
  onlineManager.setOnline(false);
  startHeartbeat(); // iniciar heartbeat para detectar reconexión automáticamente
}

// ─── Heartbeat ─────────────────────────────────────────────────────────────

function startHeartbeat() {
  if (heartbeatTimer) return; // ya corriendo
  heartbeatTimer = setInterval(async () => {
    const up = await checkConnectivity();
    if (up) {
      markOnline();
    }
  }, HEARTBEAT_INTERVAL);
}

function stopHeartbeat() {
  if (heartbeatTimer) {
    clearInterval(heartbeatTimer);
    heartbeatTimer = null;
  }
}

// ─── Registro GLOBAL de listeners (se ejecuta al importar el módulo) ───────

if (typeof window !== 'undefined') {
  // Browser events: detección instantánea de cambios de interfaz de red
  window.addEventListener('online', () => {
    // El browser dice que hay red. Verificamos con un health check real.
    checkConnectivity().then(up => {
      if (up) {
        markOnline();
      } else {
        // Hay red pero no internet. Iniciar heartbeat para re-verificar.
        startHeartbeat();
      }
    });
  });

  window.addEventListener('offline', () => {
    markOffline();
  });

  // Si arrancamos offline, iniciar heartbeat
  if (!navigator.onLine) {
    // Dar un tick para que los módulos se inicialicen
    setTimeout(() => markOffline(), 0);
  }
}

// ─── API pública ───────────────────────────────────────────────────────────

/**
 * Hook reactivo para obtener el estado de conexión.
 * Solo devuelve el signal, los listeners ya están registrados a nivel de módulo.
 */
export function useOnlineStatus() {
  return isOnline;
}

/**
 * Permite cambiar el estado de conexión desde interceptores de red (Eden fetcher).
 * Respeta el grace period post-reconexión para evitar flicker.
 */
export function setOnlineStatus(online: boolean) {
  if (online) {
    markOnline();
  } else {
    // Respetar grace period
    if (Date.now() < reconnectGraceUntil) return;
    markOffline();
  }
}

/**
 * Check manual de conectividad (usado por OfflineBanner's Reintentar).
 */
export { checkConnectivity };
