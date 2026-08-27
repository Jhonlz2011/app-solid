import { createStore } from "solid-js/store";
import { batch } from "solid-js";
import { authClient } from "@shared/lib/auth-client";
import { profileApi } from "@modules/profile/data/profile.api";
import type { ProfileType } from '@app/schema/dto';
import { type RbacModule, type PermissionSlug, SYSTEM_ROLES } from '@app/schema/enums';
import { connect, disconnect, enableReconnect } from "@shared/store/sse.store";
import { broadcast, BroadcastEvents } from "@shared/store/broadcast.store";
import { brandingActions } from "./branding.store";
import { getFriendlyErrorMessage } from "@shared/utils/api-errors";
import { invalidateOrgCache } from "../utils/resolve-routing";

// Prevent multiple initStore() calls
let storeInitialized = false;

// --- CONFIGURACIÓN ---
const SESSION_FLAG_KEY = 'hasSession';

// Current session ID — used to compare with WS revoke events
let currentSessionId: string | null = null;

// Helper to strip non-serializable fields from ProfileType before sending via BroadcastChannel
const sanitizeUser = ({ id, username, email, roles, permissions, entity }: ProfileType): Partial<ProfileType> =>
    ({ id, username, email, roles, permissions, entity });

// --- ESTADO REACTIVO ---
interface AuthState {
    user: ProfileType | null;
    status: 'idle' | 'loading' | 'authenticated' | 'unauthenticated';
}

const [state, setState] = createStore<AuthState>({
    user: null,
    status: 'idle',
});

// --- HELPERS ---

const setSessionFlag = (active: boolean) => {
    if (active) localStorage.setItem(SESSION_FLAG_KEY, 'true');
    else localStorage.removeItem(SESSION_FLAG_KEY);
};

// --- ACTIONS ---

export const actions = {
    login: async (credentials: { email: string; password: string }) => {
        setState('status', 'loading');
        try {
            const emailOrUsername = credentials.email.trim();
            const isEmail = emailOrUsername.includes('@');
            let authRes;
            if (isEmail) {
                authRes = await authClient.signIn.email({
                    email: emailOrUsername,
                    password: credentials.password,
                });
            } else {
                authRes = await authClient.signIn.username({
                    username: emailOrUsername,
                    password: credentials.password,
                });
            }

            if (authRes.error) {
                throw new Error(getFriendlyErrorMessage(authRes.error, 'Error al iniciar sesión'));
            }

            // Fetch user's organizations via Better-Auth
            const orgListRes = await authClient.organization.list();
            const organizations = orgListRes?.data || [];

            // Hydrate ERP profile with RBAC & Entity metadata
            const profile = await profileApi.getMe();
            currentSessionId = profile.sessionId ?? null;
            const user = profile as ProfileType;

            batch(() => {
                setState('user', user);
                setState('status', 'authenticated');
            });
            setSessionFlag(true);

            // WebSocket / SSE connection
            enableReconnect();
            connect(currentSessionId);

            // Notify other tabs via centralized broadcast (remote only, leaving active tab navigation to Login.tsx)
            broadcast.emit(BroadcastEvents.AUTH_LOGIN, { user: sanitizeUser(user), sessionId: currentSessionId }, { remoteOnly: true });

            // Sync branding if user has a companySlug
            if (user.companySlug) {
                brandingActions.loadBrandingForSlug(user.companySlug);
            }

            // Invalidate module caches for fresh menu tree on login
            const { actions: moduleActions } = await import('@shared/store/modules.store');
            moduleActions.clearModules();

            return { user, sessionId: currentSessionId, organizations };
        } catch (error) {
            setState('status', 'unauthenticated');
            throw error;
        }
    },

    /**
     * Switch active organization (Company) in Better-Auth session & reload ERP context
     */
    switchOrganization: async (organizationId: string) => {
        try {
            const res = await authClient.organization.setActive({ organizationId });
            if (res?.error) {
                throw new Error(res.error.message || 'Error al cambiar de empresa');
            }

            // Invalidate cached org list so route guards re-fetch on next navigation
            invalidateOrgCache();

            // Refresh ERP profile with new company's RBAC and permissions
            const profile = await profileApi.getMe();
            currentSessionId = profile.sessionId ?? null;
            const user = profile as ProfileType;

            batch(() => {
                setState('user', user);
                setState('status', 'authenticated');
            });

            // Sync branding
            if (user.companySlug) {
                brandingActions.loadBrandingForSlug(user.companySlug);
            }

            // Invalidate module caches for fresh menu tree
            const { actions: moduleActions } = await import('@shared/store/modules.store');
            moduleActions.clearModules();

            return { success: true, user };
        } catch (error) {
            console.error('[Auth] Failed to switch organization:', error);
            throw error;
        }
    },

    logout: async (notifyServer = true) => {
        currentSessionId = null;
        disconnect();

        // 1. Await server sign-out so session cookie is revoked on backend
        if (notifyServer) {
            try {
                await authClient.signOut();
            } catch (err) {
                console.warn('[Auth] Error signing out from server:', err);
            }
        }

        // 2. Clear state in store and flags
        batch(() => {
            setState('user', null);
            setState('status', 'unauthenticated');
        });
        setSessionFlag(false);

        // Invalidate cached org list
        invalidateOrgCache();

        // 3. Clear cached modules
        try {
            const { actions: moduleActions } = await import('@shared/store/modules.store');
            moduleActions.clearModules();
        } catch {}

        // 4. Notify other tabs via centralized broadcast
        broadcast.emit(BroadcastEvents.AUTH_LOGOUT, undefined, { remoteOnly: true });
    },

    // Legacy cleanup
    cleanupStaleSession: async () => {
        if (state.user) {
            batch(() => {
                setState('user', null);
                setState('status', 'unauthenticated');
            });
            const { actions: moduleActions } = await import('@shared/store/modules.store');
            moduleActions.clearModules();
        }
    },

    // Update user profile in store (for fine-grained reactivity)
    updateUser: (updates: Partial<ProfileType>, shouldBroadcast = true) => {
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
            const userData = await profileApi.getMe();
            currentSessionId = userData.sessionId ?? null;
            batch(() => {
                setState('user', userData as ProfileType);
                setState('status', 'authenticated');
            });
            setSessionFlag(true);

            // WebSocket
            enableReconnect();
            connect(currentSessionId);

            // Sync branding for sidebar (if entering via zelys.app without subdomain)
            if (userData.companySlug) {
                brandingActions.loadBrandingForSlug(userData.companySlug);
            }

            return true;
        } catch {
            currentSessionId = null;
            setState('status', 'unauthenticated');
            setSessionFlag(false);
            return false;
        }
    },

    // Refresh user session/profile data from server (silently in background)
    refreshSession: async (): Promise<boolean> => {
        try {
            const userData = await profileApi.getMe();
            // Store is reactively updated, keeping the currentSessionId and authenticated status intact
            setState('user', userData as ProfileType);
            return true;
        } catch (error) {
            console.error('[Auth] Failed to refresh session:', error);
            return false;
        }
    },

    // Initialize global listeners
    initStore: () => {
        if (typeof window === 'undefined') return;
        if (storeInitialized) return;
        storeInitialized = true;

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
        // sse.store dispatches CustomEvents for every incoming WS message.
        // We filter by userId to only update our own user's data.
        window.addEventListener('user:profile_updated', (e: Event) => {
            const { userId, username, email } = (e as CustomEvent).detail ?? {};
            if (!state.user || String(state.user.id) !== String(userId)) return;
            // Granular update — SolidJS only re-renders components that read these specific fields
            if (username !== undefined) setState('user', 'username', username);
            if (email !== undefined) setState('user', 'email', email);
        });

        // WS: real-time RBAC/permissions update from the server
        window.addEventListener('user:rbac_changed', (e: Event) => {
            const { userId } = (e as CustomEvent).detail ?? {};
            if (!state.user || String(state.user.id) !== String(userId)) return;
            if (import.meta.env.DEV) console.log('[Auth] RBAC permissions updated. Refreshing store...');
            actions.refreshSession();
        });

        // WS: real-time email verification from another device
        window.addEventListener('user:email_verified', (e: Event) => {
            const { userId } = (e as CustomEvent).detail ?? {};
            if (!state.user || String(state.user.id) !== String(userId)) return;
            if (import.meta.env.DEV) console.log('[Auth] Email verified on another device. Refreshing store...');
            actions.refreshSession();
        });

        // Cross-tab sync via centralized broadcast store (P0-4: replaces separate auth_sync BroadcastChannel)
        broadcast.on(BroadcastEvents.AUTH_LOGOUT, () => {
            currentSessionId = null;
            // Only set status — don't clear user (causes sidebar flash).
            // The full-page reload below will reset all in-memory stores anyway.
            setState('status', 'unauthenticated');
            disconnect();
            // Navigate if still on a protected page
            if (!window.location.pathname.startsWith('/login')) {
                window.location.href = '/login';
            }
        });

        broadcast.on(BroadcastEvents.AUTH_LOGIN, async (data) => {
            if (!data?.user) return;
            currentSessionId = data.sessionId ?? null;
            batch(() => {
                setState('user', data.user);
                setState('status', 'authenticated');
            });
            setSessionFlag(true);
            enableReconnect();
            connect(currentSessionId);
            // Navigate if still on the login page
            // Preserve redirect param if present (e.g., /login?redirect=/suppliers → /suppliers)
            if (window.location.pathname.startsWith('/login')) {
                const { isGlobalPortalHost, buildTenantUrl } = await import('@app/schema/utils');
                const params = new URLSearchParams(window.location.search);
                const redirectTo = params.get('redirect');
                const safePath = redirectTo && redirectTo.startsWith('/') ? redirectTo : '/dashboard';
                const isGlobal = isGlobalPortalHost(window.location.hostname);
                if (isGlobal && data.user.companySlug) {
                    window.location.href = buildTenantUrl(data.user.companySlug, safePath, { queryParams: { session: 'true' } });
                } else {
                    window.location.href = safePath;
                }
            }
        });

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
        // sse.store dispatches this as a CustomEvent when the backend sends user:session_revoked.
        window.addEventListener('user:session_revoked', ((e: CustomEvent) => {
            const { sessionId } = e.detail ?? {};
            if (sessionId && sessionId === currentSessionId) {
                // MY session was revoked by another device — force logout
                actions.logout(false);
                window.location.href = '/login';
            }
            // For other sessions: SessionsSection.tsx handles the list refresh via its own listener
        }) as EventListener);

        // GLOBAL 401 AUTHORIZATION DROP
        // Triggered by either the WebSocket closing with 4001/1008 or the Eden API fetcher getting a 401.
        window.addEventListener('auth:unauthorized', () => {
            console.warn('[Auth] Detected 401 drop. Executing clean auto-logout...');
            if (window.location.pathname !== '/login') {
                actions.logout(false);
                window.location.href = '/login';
            }
        });
    }
};

// --- GETTERS (Selectors) ---

export const useAuth = () => {
    return {
        user: () => state.user,
        isAuthenticated: () => state.status === 'authenticated',
        isLoading: () => state.status === 'loading',
        hasPermission: (perm: PermissionSlug) => {
            const u = state.user;
            if (!u?.permissions) return false;
            if (u.roles?.includes(SYSTEM_ROLES.SUPERADMIN)) return true;
            return u.permissions.includes(perm);
        },
        isAdmin: () => state.user?.roles?.includes(SYSTEM_ROLES.SUPERADMIN) || false,
        hasRole: (role: string) => state.user?.roles?.includes(role) || false,
        canRead: (module: RbacModule) => {
            const u = state.user;
            if (!u) return false;
            if (u.roles?.includes(SYSTEM_ROLES.SUPERADMIN)) return true;
            return u.permissions?.includes(`${module}.read`) || false;
        },
        canAdd: (module: RbacModule) => {
            const u = state.user;
            if (!u) return false;
            if (u.roles?.includes(SYSTEM_ROLES.SUPERADMIN)) return true;
            return u.permissions?.includes(`${module}.create`) || false;
        },
        canEdit: (module: RbacModule) => {
            const u = state.user;
            if (!u) return false;
            if (u.roles?.includes(SYSTEM_ROLES.SUPERADMIN)) return true;
            return u.permissions?.includes(`${module}.update`) || false;
        },
        canDelete: (module: RbacModule) => {
            const u = state.user;
            if (!u) return false;
            if (u.roles?.includes(SYSTEM_ROLES.SUPERADMIN)) return true;
            return u.permissions?.includes(`${module}.delete`) || false;
        },
    };
};