// src/modules/auth/auth.store.ts
import { createStore } from "solid-js/store";
import { batch } from "solid-js";
import { authApi } from "../api/auth.api";
import type { LoginRequest, User } from "../types/auth.types";
import { connect, disconnect, enableReconnect } from "@shared/store/ws.store";
import { broadcast, BroadcastEvents } from "@shared/store/broadcast.store";

// --- CONFIGURACIÓN ---
const SESSION_FLAG_KEY = 'hasSession';

// Current session ID — used to compare with WS revoke events
let currentSessionId: string | null = null;

// Helper to strip non-serializable fields from User before sending via BroadcastChannel
const sanitizeUser = ({ id, username, email, roles, permissions, entity }: User): Partial<User> =>
    ({ id, username, email, roles, permissions, entity });

// --- ESTADO REACTIVO ---
interface AuthState {
    user: User | null;
    status: 'idle' | 'loading' | 'authenticated' | 'unauthenticated';
}

const [state, setState] = createStore<AuthState>({
    user: null,
    status: 'idle',
});

// --- BROADCAST CHANNEL (Cross-tab sync) ---
const authChannel = typeof window !== 'undefined' ? new BroadcastChannel('auth_sync') : null;

// --- HELPERS ---

const setSessionFlag = (active: boolean) => {
    if (active) localStorage.setItem(SESSION_FLAG_KEY, 'true');
    else localStorage.removeItem(SESSION_FLAG_KEY);
};

// --- ACTIONS ---

export const actions = {
    login: async (credentials: LoginRequest) => {
        setState('status', 'loading');
        try {
            const data = await authApi.login(credentials);
            // Server set httpOnly cookie — zero token management needed
            currentSessionId = data.sessionId ?? null;
            batch(() => {
                setState('user', data.user);
                setState('status', 'authenticated');
            });
            setSessionFlag(true);

            // WebSocket
            enableReconnect();
            connect();

            // Notify other tabs
            if (authChannel) {
                authChannel.postMessage({ type: 'LOGIN', user: sanitizeUser(data.user) });
            }

            return data;
        } catch (error) {
            setState('status', 'unauthenticated');
            throw error;
        }
    },

    logout: async (notifyServer = true) => {
        currentSessionId = null;
        // Only change status — route guards read this, NOT the sidebar.
        // SolidJS fine-grained reactivity: the sidebar reads state.user and modules(),
        // NOT state.status, so it won't re-render here. Zero visual flash.
        setState('status', 'unauthenticated');
        setSessionFlag(false);
        disconnect();

        // Notify other tabs
        if (authChannel) {
            authChannel.postMessage({ type: 'LOGOUT' });
        }

        // Notify server (only for voluntary logout)
        if (notifyServer) {
            authApi.logout().catch(() => {});
        }
    },

    // Phase 2 cleanup: called from auth route beforeLoad once login page is loading.
    // At this point the sidebar/layout is already unmounted, so clearing is flash-free.
    cleanupStaleSession: async () => {
        if (state.user) {
            setState('user', null);
            const { actions: moduleActions } = await import('@shared/store/modules.store');
            moduleActions.clearModules();
        }
    },

    // Update user profile in store (for fine-grained reactivity)
    updateUser: (updates: Partial<User>, shouldBroadcast = true) => {
        if (!state.user) return;
        const updatedUser = { ...state.user, ...updates };
        setState('user', updatedUser);
        if (shouldBroadcast) {
            broadcast.emit(BroadcastEvents.PROFILE_UPDATE, { user: updatedUser });
        }
    },

    // Session initialization — just call GET /me, cookie is sent automatically
    initSession: async (): Promise<boolean> => {
        if (state.status === 'authenticated') return true;

        setState('status', 'loading');

        try {
            // Cookie goes automatically via credentials: 'include'
            const userData = await authApi.getMe();
            currentSessionId = userData.sessionId ?? null;
            batch(() => {
                setState('user', userData);
                setState('status', 'authenticated');
            });
            setSessionFlag(true);

            // WebSocket
            enableReconnect();
            connect();

            return true;
        } catch {
            currentSessionId = null;
            setState('status', 'unauthenticated');
            setSessionFlag(false);
            return false;
        }
    },

    // Initialize global listeners
    initStore: () => {
        if (typeof window === 'undefined') return;

        // Prevent multiple initializations
        if ((window as any).__authStoreInitialized) {
            console.log('[Auth] initStore already initialized, skipping');
            return;
        }
        (window as any).__authStoreInitialized = true;

        // Storage event (other tab logged out)
        window.addEventListener('storage', (e: StorageEvent) => {
            if (e.key === SESSION_FLAG_KEY) {
                const newValue = e.newValue === 'true';
                if (!newValue) {
                    // Only set status — don't clear user (causes sidebar flash).
                    // The full-page reload below will reset all in-memory stores anyway.
                    setState('status', 'unauthenticated');
                    disconnect();
                    window.location.href = '/login';
                }
            }
        });

        // WS: real-time profile update from another tab/device
        // ws.store dispatches CustomEvents for every incoming WS message.
        // We filter by userId to only update our own user's data.
        window.addEventListener('user:profile_updated', (e: Event) => {
            const { userId, username, email } = (e as CustomEvent).detail ?? {};
            if (!state.user || state.user.id !== userId) return;
            // Granular update — SolidJS only re-renders components that read these specific fields
            if (username !== undefined) setState('user', 'username', username);
            if (email !== undefined) setState('user', 'email', email);
        });

        // Cross-tab sync via BroadcastChannel
        if (authChannel) {
            authChannel.onmessage = (e) => {
                if (e.data.type === 'LOGOUT') {
                    currentSessionId = null;
                    // Only set status — don't clear user (causes sidebar flash).
                    // The full-page reload below will reset all in-memory stores anyway.
                    setState('status', 'unauthenticated');
                    disconnect();
                    // Navigate if still on a protected page
                    if (!window.location.pathname.startsWith('/login')) {
                        window.location.href = '/login';
                    }
                } else if (e.data.type === 'LOGIN' && e.data.user) {
                    batch(() => {
                        setState('user', e.data.user);
                        setState('status', 'authenticated');
                    });
                    setSessionFlag(true);
                    enableReconnect();
                    connect();
                    // Navigate if still on the login page
                    // Preserve redirect param if present (e.g., /login?redirect=/suppliers → /suppliers)
                    if (window.location.pathname.startsWith('/login')) {
                        const params = new URLSearchParams(window.location.search);
                        const redirectTo = params.get('redirect');
                        const safePath = redirectTo && redirectTo.startsWith('/') ? redirectTo : '/dashboard';
                        window.location.href = safePath;
                    }
                }
            };
        }

        // Centralized broadcast store (profile updates from other tabs via BroadcastChannel)
        broadcast.init();
        broadcast.on(BroadcastEvents.PROFILE_UPDATE, (data) => {
            if (data?.user && state.user) {
                // Granular updates only — DO NOT spread/replace the whole user object
                if (data.user.username !== undefined) setState('user', 'username', data.user.username);
                if (data.user.email !== undefined) setState('user', 'email', data.user.email);
            }
        });

        // WS: session revocation — if MY session is revoked from another tab/browser, log out.
        // ws.store dispatches this as a CustomEvent when the backend sends user:session_revoked.
        window.addEventListener('user:session_revoked', ((e: CustomEvent) => {
            const { sessionId } = e.detail ?? {};
            if (sessionId && sessionId === currentSessionId) {
                // MY session was revoked by another device — force logout
                actions.logout(false);
                window.location.href = '/login';
            }
            // For other sessions: SessionsSection.tsx handles the list refresh via its own listener
        }) as EventListener);
    }
};

// --- GETTERS (Selectors) ---

export const useAuth = () => {
    return {
        user: () => state.user,
        isAuthenticated: () => state.status === 'authenticated',
        isLoading: () => state.status === 'loading',
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