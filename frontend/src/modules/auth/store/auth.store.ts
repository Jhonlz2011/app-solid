// src/modules/auth/auth.store.ts
import { createStore } from "solid-js/store";
import { batch } from "solid-js";
import { authApi } from "../api/auth.api";
import { LoginRequest, User, AuthError } from "../types/auth.types";
import { connect, subscribe, disconnect, enableReconnect } from "@shared/store/ws.store";
import { broadcast, BroadcastEvents } from "@shared/store/broadcast.store";

// --- CONFIGURACIÓN ---
const SESSION_FLAG_KEY = 'hasSession';
const TOKEN_REFRESH_MARGIN = 2 * 60 * 1000; // 2 minutos

// Helper to strip non‑serializable fields from User before sending via BroadcastChannel
const sanitizeUser = ({ id, username, email, roles, permissions, entity }: User): Partial<User> =>
    ({ id, username, email, roles, permissions, entity });

// --- VARIABLES PRIVADAS (Memoria, fuera del Store reactivo) ---
// Reemplazan a las propiedades privadas de tu clase
let accessToken: string | null = null;
let currentSessionId: string | null = null; // Selector de la sesión actual
let tokenExpiresAt: number | null = null;
let refreshTimer: ReturnType<typeof setTimeout> | null = null;
let refreshPromise: Promise<string> | null = null;

// --- BROADCAST CHANNEL (Cross-tab token sync) ---
const authChannel = typeof window !== 'undefined' ? new BroadcastChannel('auth_sync') : null;

// --- ESTADO REACTIVO (Para la UI) ---
interface AuthState {
    user: User | null;
    status: 'idle' | 'loading' | 'authenticated' | 'unauthenticated';
    hasSessionFlag: boolean; // Para UI optimista
}

const [state, setState] = createStore<AuthState>({
    user: null,
    status: 'idle',
    hasSessionFlag: localStorage.getItem(SESSION_FLAG_KEY) === 'true',
});

// --- HELPERS INTERNOS (Lógica de tu AuthService original) ---

const setSessionFlag = (active: boolean) => {
    if (active) localStorage.setItem(SESSION_FLAG_KEY, 'true');
    else localStorage.removeItem(SESSION_FLAG_KEY);
    setState('hasSessionFlag', active);
};

const clearInternalState = () => {
    accessToken = null;
    currentSessionId = null;
    tokenExpiresAt = null;
    if (refreshTimer) {
        clearTimeout(refreshTimer);
        refreshTimer = null;
    }
};

const scheduleTokenRefresh = () => {
    if (refreshTimer) {
        clearTimeout(refreshTimer);
        refreshTimer = null;
    }

    if (!tokenExpiresAt) return;

    const timeUntilRefresh = tokenExpiresAt - Date.now() - TOKEN_REFRESH_MARGIN;

    if (timeUntilRefresh > 0) {
        refreshTimer = setTimeout(() => {
            silentRefresh();
        }, timeUntilRefresh);
    } else {
        // Si ya pasó el tiempo, refrescar inmediatamente (o en el próximo tick)
        silentRefresh();
    }
};

const handleTokenUpdate = (token: string, user?: User, broadcast = true) => {
    accessToken = token;
    setSessionFlag(true);

    try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        tokenExpiresAt = payload.exp * 1000;
        currentSessionId = payload.sessionId; // Capturar ID de sesión actual
    } catch {
        // Fallback si no es JWT estándar
        tokenExpiresAt = Date.now() + 15 * 60 * 1000;
    }

    scheduleTokenRefresh();

    // Actualizar UI Store
    batch(() => {
        setState('status', 'authenticated');
        if (user) setState('user', user);
    });

    // Conectar WebSocket y suscribirse al canal del usuario
    enableReconnect(); // Habilitar reconexión para nueva sesión
    connect();
    if (user?.id) {
        subscribe(`user:${user.id}`);
    } else if (state.user?.id) {
        subscribe(`user:${state.user.id}`);
    }

    // Broadcast to other tabs (only if this is the originating tab)
    if (broadcast && authChannel && user) {
        const safeUser = sanitizeUser(user);
        authChannel.postMessage({ type: 'TOKEN_SYNC', accessToken: token, user: safeUser });
    }
};

const silentRefresh = async (retryCount = 0) => {
    try {
        await actions.refresh();
    } catch (error: any) {
        const errorMessage = error.message || '';

        // Only logout on definitive auth errors (token-related)
        // These indicate the token is truly invalid, not just a network issue
        const isDefinitiveAuthError =
            error instanceof AuthError ||
            errorMessage.includes('Token') ||
            errorMessage.includes('revocado') ||
            errorMessage.includes('expirado') ||
            errorMessage.includes('inválido');

        if (isDefinitiveAuthError) {
            console.warn('Silent refresh: token is invalid, logging out:', errorMessage);
            actions.logout(false);
            return;
        }

        // For network errors or server issues, retry with exponential backoff
        const MAX_RETRIES = 5;
        if (retryCount < MAX_RETRIES) {
            const delay = Math.min(5000 * Math.pow(1.5, retryCount), 30000); // 5s -> 7.5s -> 11s -> 17s -> 25s
            console.log(`Silent refresh failed (Network/Server?), retrying in ${Math.round(delay / 1000)}s (${retryCount + 1}/${MAX_RETRIES})...`);
            setTimeout(() => silentRefresh(retryCount + 1), delay);
        } else {
            // After all retries, schedule one more attempt later instead of logging out
            console.warn('Silent refresh failed after retries, will retry in 1 minute...');
            setTimeout(() => silentRefresh(0), 60000);
        }
    }
};

// --- API PÚBLICA (ACTIONS) ---

export const actions = {
    login: async (credentials: LoginRequest) => {
        setState('status', 'loading');
        try {
            const data = await authApi.login(credentials);
            handleTokenUpdate(data.accessToken, data.user);
            return data;
        } catch (error) {
            setState('status', 'unauthenticated');
            throw error;
        }
    },

    logout: async (notifyServer = true) => {
        // 1. Limpieza local inmediata
        clearInternalState();
        setSessionFlag(false);
        setState({ user: null, status: 'unauthenticated' });

        // 2. Clear cached modules (important for different user login)
        const { actions: moduleActions } = await import('@shared/store/modules.store');
        moduleActions.clearModules();

        // 3. Broadcast logout to other tabs
        if (authChannel) {
            authChannel.postMessage({ type: 'LOGOUT' });
        }

        // 4. Notificar al servidor (solo si fue logout voluntario)
        if (notifyServer) {
            authApi.logout().catch(() => { });
        }

        // 5. Desconectar WebSocket
        disconnect();

        // Nota: La navegación se maneja en el componente que llama (ej: Sidebar)
    },

    // Update user profile in store (for fine-grained reactivity)
    updateUser: (updates: Partial<User>, shouldBroadcast = true) => {
        if (!state.user) return;

        // Merge updates into existing user
        const updatedUser = { ...state.user, ...updates };
        setState('user', updatedUser);

        // Broadcast to other tabs using centralized broadcast store (auto-sanitizes)
        if (shouldBroadcast) {
            broadcast.emit(BroadcastEvents.PROFILE_UPDATE, { user: updatedUser });
        }
    },

    // Tu lógica de Mutex para evitar dobles refrescos
    refresh: async (): Promise<string> => {
        if (refreshPromise) {
            console.log('[Auth] refresh: reusing existing promise');
            return refreshPromise;
        }

        console.log('[Auth] refresh: starting new refresh call');
        refreshPromise = (async () => {
            try {
                const { accessToken: newToken } = await authApi.refreshToken();
                console.log('[Auth] refresh: got new token from server');
                handleTokenUpdate(newToken);
                return newToken;
            } catch (error) {
                console.log('[Auth] refresh: failed');
                // Don't logout here - let the caller decide (initSession has retries, silentRefresh handles errors)
                throw error;
            } finally {
                refreshPromise = null;
            }
        })();

        return refreshPromise;
    },

    // Inicialización al cargar la App (called from protected routes)
    initSession: async (): Promise<boolean> => {
        // NOTE: We intentionally DON'T check hasSessionFlag here anymore.
        // On mobile devices, localStorage can be cleared when the browser is killed,
        // but httpOnly cookies persist. Always try refresh to recover the session.

        // Si ya estamos autenticados, no hacer nada
        if (accessToken && state.status === 'authenticated') return true;

        setState('status', 'loading');

        // First, try to get token from another tab (avoid creating new session)
        console.log('[Auth] initSession: requesting token from other tabs...');
        if (authChannel) {
            const tokenFromOtherTab = await new Promise<{ accessToken: string; user: User } | null>((resolve) => {
                const timeout = setTimeout(() => {
                    console.log('[Auth] initSession: no response from other tabs (timeout)');
                    resolve(null);
                }, 300); // Increased to 300ms

                const handler = (e: MessageEvent) => {
                    if (e.data.type === 'TOKEN_RESPONSE' && e.data.accessToken) {
                        console.log('[Auth] initSession: received token from another tab!');
                        clearTimeout(timeout);
                        authChannel!.removeEventListener('message', handler);
                        resolve({ accessToken: e.data.accessToken, user: e.data.user });
                    }
                };

                authChannel.addEventListener('message', handler);
                authChannel.postMessage({ type: 'TOKEN_REQUEST' });

                // Cleanup on timeout
                setTimeout(() => authChannel!.removeEventListener('message', handler), 350);
            });

            if (tokenFromOtherTab) {
                handleTokenUpdate(tokenFromOtherTab.accessToken, tokenFromOtherTab.user, false);
                return true;
            }
        }

        // Fallback: refresh token from server (only if no other tab responded)
        // Retry a few times in case the network is slow to initialize after browser restart
        let retries = 3;
        while (retries > 0) {
            try {
                const token = await actions.refresh();
                const user = await authApi.getMe(token);
                batch(() => {
                    setState('user', user);
                    setState('status', 'authenticated');
                });
                return true;
            } catch (error: any) {
                const errorMessage = error.message || '';

                // If it's a definitive auth error, don't retry
                const isDefinitiveAuthError =
                    errorMessage.includes('Token') ||
                    errorMessage.includes('revocado') ||
                    errorMessage.includes('expirado') ||
                    errorMessage.includes('inválido');

                if (isDefinitiveAuthError) {
                    console.warn('[Auth] initSession: auth error, not retrying:', errorMessage);
                    break;
                }

                retries--;
                if (retries > 0) {
                    console.log(`[Auth] initSession: refresh failed, retrying (${3 - retries}/3)...`);
                    await new Promise(r => setTimeout(r, 500)); // Wait 500ms before retry
                }
            }
        }

        // All retries failed
        setState('status', 'unauthenticated');
        return false;
    },

    // Inicializar listeners globales (Storage)
    initStore: () => {
        if (typeof window === 'undefined') return;

        // Prevent multiple initializations
        if ((window as any).__authStoreInitialized) {
            console.log('[Auth] initStore already initialized, skipping');
            return;
        }
        (window as any).__authStoreInitialized = true;
        console.log('[Auth] initStore initializing...');

        const handleStorageChange = (e: StorageEvent) => {
            if (e.key === SESSION_FLAG_KEY) {
                const newValue = e.newValue === 'true';
                if (state.hasSessionFlag !== newValue) {
                    setSessionFlag(newValue);
                    if (!newValue) {
                        // Logged out in another tab
                        clearInternalState();
                        setState({ user: null, status: 'unauthenticated' });
                        window.location.href = '/login';
                    } else {
                        // Logged in in another tab - BroadcastChannel will handle token sync
                        // Don't call initSession() here to avoid creating duplicate sessions
                        console.log('[Auth] Storage: another tab logged in, waiting for BroadcastChannel');
                    }
                }
            }
        };

        window.addEventListener('storage', handleStorageChange);

        // Listen for cross-tab token sync
        if (authChannel) {
            authChannel.onmessage = (e) => {
                if (e.data.type === 'TOKEN_SYNC' && e.data.accessToken) {
                    console.log('[Auth] BroadcastChannel: received TOKEN_SYNC from login');
                    // Receive token from another tab WITHOUT calling refresh
                    handleTokenUpdate(e.data.accessToken, e.data.user, false);
                } else if (e.data.type === 'TOKEN_REQUEST') {
                    // Another tab is requesting our token
                    console.log('[Auth] BroadcastChannel: received TOKEN_REQUEST, hasToken:', !!accessToken);
                    if (accessToken && state.user) {
                        console.log('[Auth] BroadcastChannel: sending TOKEN_RESPONSE');
                        const safeUser = sanitizeUser(state.user);
                        authChannel.postMessage({ type: 'TOKEN_RESPONSE', accessToken, user: safeUser });
                    }
                } else if (e.data.type === 'LOGOUT') {
                    clearInternalState();
                    setState({ user: null, status: 'unauthenticated' });
                }
                // Note: PROFILE_UPDATE is now handled via centralized broadcast store below
            };
        }

        // Initialize centralized broadcast store and listen for profile updates
        broadcast.init();
        broadcast.on(BroadcastEvents.PROFILE_UPDATE, (data) => {
            if (data?.user) {
                console.log('[Auth] Broadcast: received PROFILE_UPDATE');
                setState('user', data.user);
            }
        });

        // Escuchar eventos de WebSocket (Revocación de sesión)
        window.addEventListener('sessions:update', ((e: CustomEvent) => {
            const { type, sessionId } = e.detail;

            if (type === 'logout') {
                // Logout global (ej: cambio de contraseña)
                console.log('Global logout received');
                actions.logout();
                window.location.href = '/login';
            } else if (type === 'revoke') {
                // Revocación específica: Solo salir si es MI sesión
                // sessionId puede ser string o array (para manejar rotación de tokens)
                const ids = Array.isArray(sessionId) ? sessionId : [sessionId];
                if (currentSessionId && ids.includes(currentSessionId)) {
                    actions.logout(false); // No notificar al servidor (ya está revocado)
                    window.location.href = '/login';
                }
            }
        }) as EventListener);
    }
};

// --- GETTERS (Selectors) ---

// Para usar dentro de componentes (Reactivos)
export const useAuth = () => {
    return {
        user: () => state.user,
        isAuthenticated: () => state.status === 'authenticated',
        isLoading: () => state.status === 'loading',
        // Getters para permisos
        hasPermission: (perm: string) => {
            const u = state.user;
            if (!u?.permissions) return false;
            if (u.roles?.includes('admin') || u.roles?.includes('superadmin')) return true;
            return u.permissions.includes(perm);
        },
        isAdmin: () => state.user?.roles?.includes('admin') || state.user?.roles?.includes('superadmin') || false,
        hasRole: (role: string) => state.user?.roles?.includes(role) || false,
        canRead: (module: string) => {
            const u = state.user;
            if (!u) return false;
            if (u.roles?.includes('admin') || u.roles?.includes('superadmin')) return true;
            return u.permissions?.includes(`${module}.read`) || false;
        },
        canAdd: (module: string) => {
            const u = state.user;
            if (!u) return false;
            if (u.roles?.includes('admin') || u.roles?.includes('superadmin')) return true;
            return u.permissions?.includes(`${module}.add`) || false;
        },
        canEdit: (module: string) => {
            const u = state.user;
            if (!u) return false;
            if (u.roles?.includes('admin') || u.roles?.includes('superadmin')) return true;
            return u.permissions?.includes(`${module}.edit`) || false;
        },
        canDelete: (module: string) => {
            const u = state.user;
            if (!u) return false;
            if (u.roles?.includes('admin') || u.roles?.includes('superadmin')) return true;
            return u.permissions?.includes(`${module}.delete`) || false;
        },
    };
};

// Para usar fuera de componentes (ej: Axios Interceptor) - NO Reactivo
export const getAccessToken = () => accessToken;