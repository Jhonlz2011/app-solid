// src/modules/auth/auth.store.ts
import { createStore, produce } from "solid-js/store";
import { batch } from "solid-js";
import { authApi } from "./auth.api";
import { LoginRequest, User } from "./models/auth.types";

// --- CONFIGURACIÓN ---
const SESSION_FLAG_KEY = 'hasSession';
const TOKEN_REFRESH_MARGIN = 2 * 60 * 1000; // 2 minutos

// --- VARIABLES PRIVADAS (Memoria, fuera del Store reactivo) ---
// Reemplazan a las propiedades privadas de tu clase
let accessToken: string | null = null;
let tokenExpiresAt: number | null = null;
let refreshTimer: ReturnType<typeof setTimeout> | null = null;
let refreshPromise: Promise<string> | null = null;

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

const handleTokenUpdate = (token: string, user?: User) => {
    accessToken = token;
    setSessionFlag(true);

    try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        tokenExpiresAt = payload.exp * 1000;
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
};

const silentRefresh = async () => {
    try {
        await actions.refresh();
    } catch (error) {
        console.warn('Silent refresh failed:', error);
        actions.logout(); // Si falla el silencioso, sacamos al usuario
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

    logout: async () => {
        // 1. Limpieza local inmediata
        clearInternalState();
        setSessionFlag(false);
        setState({ user: null, status: 'unauthenticated' });

        // 2. Notificar al servidor (fire-and-forget para UX rápida)
        authApi.logout().catch(() => { });

        // Nota: La navegación se maneja en el componente que llama (ej: Sidebar)
    },

    // Tu lógica de Mutex para evitar dobles refrescos
    refresh: async (): Promise<string> => {
        if (refreshPromise) return refreshPromise;

        refreshPromise = (async () => {
            try {
                const { accessToken: newToken } = await authApi.refreshToken();
                handleTokenUpdate(newToken);
                return newToken;
            } catch (error) {
                actions.logout();
                throw error;
            } finally {
                refreshPromise = null;
            }
        })();

        return refreshPromise;
    },

    // Inicialización al cargar la App
    initSession: async (): Promise<boolean> => {
        // Si no hay flag, ni intentamos (optimización)
        if (!state.hasSessionFlag) return false;

        setState('status', 'loading');
        try {
            const token = await actions.refresh(); // Usa la cookie httpOnly para obtener token
            const user = await authApi.getMe(token);
            batch(() => {
                setState('user', user);
                setState('status', 'authenticated');
            });
            return true;
        } catch {
            return false;
        }
    },

    // Inicializar listeners globales (Storage)
    initStore: () => {
        if (typeof window === 'undefined') return;

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
                        // Logged in in another tab
                        actions.initSession();
                    }
                }
            }
        };

        window.addEventListener('storage', handleStorageChange);
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