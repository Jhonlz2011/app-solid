import { createStore } from "solid-js/store";
import { batch, createMemo, createRoot } from "solid-js";
import { authClient } from "@shared/lib/auth-client";
import { profileApi } from "@modules/profile/data/profile.api";
import type { ProfileType } from '@app/schema/dto';
import { type RbacModule, type PermissionSlug, type AnyPermissionSlug, type ActionsForModule, SYSTEM_ROLES } from '@app/schema/enums';
import { resolveAllowedModulesFromFeatures, isUsableSubscriptionStatus } from '@app/schema/backend';
import { connect, disconnect, enableReconnect } from "@shared/store/sse.store";
import { broadcast, BroadcastEvents } from "@shared/store/broadcast.store";
import { brandingActions, applyBranding, getSubdomain } from "./branding.store";
import { getFriendlyErrorMessage } from "@shared/utils/api-errors";
import { invalidateOrgCache, buildHandoffTargetUrl, getSafeRedirectPath } from "../utils/resolve-routing";
import { authApi } from '../api/auth.api';

// Prevent multiple initStore() calls
let storeInitialized = false;

// In-flight dedup for initSession — prevents duplicate /me calls
// when auth.routes.tsx and router.tsx both call initSession() in sequence
let initSessionPromise: Promise<boolean> | null = null;

// Single-flight guard for global 401 handling
let unauthorizedDropPromise: Promise<void> | null = null;

const PUBLIC_AUTH_PATHS = [
    '/login',
    '/register',
    '/verify-email',
    '/accept-invitation',
    '/forgot-password',
    '/reset-password',
];

export function isPublicAuthPath(pathname: string): boolean {
    return PUBLIC_AUTH_PATHS.some(prefix => pathname.startsWith(prefix));
}

// --- CONFIGURACIÓN ---
const SESSION_FLAG_KEY = 'hasSession';

// Current session ID & active organization ID
let currentSessionId: string | null = null;
let currentActiveOrgId: string | null = null;

// Helper to strip non-serializable fields from ProfileType before sending via BroadcastChannel
const sanitizeUser = ({
    id,
    username,
    name,
    email,
    emailVerified,
    twoFactorEnabled,
    roles,
    permissions,
    entity,
    image,
    companyId,
    companySlug,
    organizationId,
    membershipStatus,
    plan,
    planName,
    planStatus,
    planPeriodEnd,
    gracePeriodEndsAt,
    features,
}: ProfileType): Partial<ProfileType> => ({
    id,
    username,
    name,
    email,
    emailVerified,
    twoFactorEnabled,
    roles,
    permissions,
    entity,
    image,
    companyId,
    companySlug,
    organizationId,
    membershipStatus,
    plan,
    planName,
    planStatus,
    planPeriodEnd,
    gracePeriodEndsAt,
    features,
});

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

const hydrateAuthenticatedSession = async () => {
    // Parallel: fetch user's organizations and full ERP profile simultaneously
    const [orgListRes, profile] = await Promise.all([
        authClient.organization.list(),
        profileApi.getMe(),
    ]);
    const organizations = orgListRes?.data || [];
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

    // Atomic in-memory hydration of modules (0ms navigation)
    if (Array.isArray(profile.modules)) {
        const { actions: moduleActions } = await import('@shared/store/modules.store');
        moduleActions.setModules(profile.modules, user);
    }

    return { requiresTwoFactor: false as const, user, sessionId: currentSessionId, organizations };
};

// --- ACTIONS ---

export const actions = {
    login: async (credentials: { email: string; password: string; turnstileToken?: string | null }) => {
        setState('status', 'loading');
        try {
            invalidateOrgCache();
            const emailOrUsername = credentials.email.trim();
            const isEmail = emailOrUsername.includes('@');
            const turnstileHeaders = credentials.turnstileToken
                ? { 'x-turnstile-token': credentials.turnstileToken }
                : {};
            let authRes;
            if (isEmail) {
                authRes = await authClient.signIn.email({
                    email: emailOrUsername,
                    password: credentials.password,
                    fetchOptions: { headers: turnstileHeaders },
                });
            } else {
                authRes = await authClient.signIn.username({
                    username: emailOrUsername,
                    password: credentials.password,
                    fetchOptions: { headers: turnstileHeaders },
                });
            }

            if (authRes.error) {
                throw new Error(getFriendlyErrorMessage(authRes.error, 'Error al iniciar sesión'));
            }

            // Better Auth twoFactor plugin returns { twoFactorRedirect: true } before creating a session
            const responseData = authRes.data as { twoFactorRedirect?: boolean } | null | undefined;
            if (responseData?.twoFactorRedirect) {
                setState('status', 'unauthenticated');
                return { requiresTwoFactor: true as const };
            }

            return await hydrateAuthenticatedSession();
        } catch (error) {
            setState('status', 'unauthenticated');
            throw error;
        }
    },

    /**
     * Completes a pending Better Auth two-factor login challenge (TOTP or backup code)
     * and hydrates the full ERP profile/session context.
     */
    completeTwoFactorLogin: async (payload: { code: string; mode: 'totp' | 'backup'; trustDevice?: boolean }) => {
        setState('status', 'loading');
        try {
            invalidateOrgCache();
            const cleanCode = payload.code.trim();
            const res = payload.mode === 'backup'
                ? await authClient.twoFactor.verifyBackupCode({
                    code: cleanCode,
                    trustDevice: Boolean(payload.trustDevice),
                })
                : await authClient.twoFactor.verifyTotp({
                    code: cleanCode,
                    trustDevice: Boolean(payload.trustDevice),
                });

            if (res.error) {
                throw new Error(getFriendlyErrorMessage(res.error, 'Código de verificación inválido'));
            }

            return await hydrateAuthenticatedSession();
        } catch (error) {
            setState('status', 'unauthenticated');
            throw error;
        }
    },

    /**
     * Single-flight 401 handler: cleanly awaits local logout/cache cleanup
     * and redirects to /login preserving the intended ?redirect= destination.
     */
    handleUnauthorizedDrop: async () => {
        if (typeof window === 'undefined') return;
        if (isPublicAuthPath(window.location.pathname)) return;
        if (unauthorizedDropPromise) return unauthorizedDropPromise;

        unauthorizedDropPromise = (async () => {
            try {
                const currentHref = `${window.location.pathname}${window.location.search}${window.location.hash}`;
                const safeRedirect = getSafeRedirectPath(currentHref);
                await actions.logout(false);
                const loginTarget = safeRedirect !== '/dashboard'
                    ? `/login?redirect=${encodeURIComponent(safeRedirect)}`
                    : '/login';
                window.location.href = loginTarget;
            } finally {
                unauthorizedDropPromise = null;
            }
        })();

        return unauthorizedDropPromise;
    },

    /**
     * Switch active organization (Company) in Better-Auth session & reload ERP context
     */
    switchOrganization: async (organizationId: string) => {
        if (!organizationId) return { success: true, user: state.user };

        // Deduplication: if already active on this organization, skip redundant network call
        if (currentActiveOrgId === organizationId && state.user?.companySlug) {
            return { success: true, user: state.user };
        }

        try {
            const res = await authClient.organization.setActive({ organizationId });
            if (res?.error) {
                throw new Error(res.error.message || 'Error al cambiar de empresa');
            }

            currentActiveOrgId = organizationId;

            // Clear in-memory query cache when switching organizations to prevent cross-tenant data leaks
            try {
                const { queryClient } = await import('@shared/lib/queryClient');
                queryClient.clear();
            } catch (err) {
                console.warn('[Auth] Error clearing queryClient on org switch:', err);
            }

            // Refresh ERP profile with new company's RBAC, permissions, and module tree
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

            // Atomic in-memory hydration of modules for the new tenant
            if (Array.isArray(profile.modules)) {
                const { actions: moduleActions } = await import('@shared/store/modules.store');
                moduleActions.setModules(profile.modules, user);
            }

            return { success: true, user };
        } catch (error) {
            console.error('[Auth] Failed to switch organization:', error);
            throw error;
        }
    },

    logout: async (notifyServer = true) => {
        currentSessionId = null;
        currentActiveOrgId = null;
        disconnect();

        // 1. Await server sign-out so session cookie is revoked on backend
        if (notifyServer) {
            try {
                await authClient.signOut();
            } catch (err) {
                console.warn('[Auth] Error signing out from server:', err);
            }
        }

        // 1.1 Securely clear in-memory query cache & IndexedDB persisted state
        try {
            const { queryClient, persister } = await import('@shared/lib/queryClient');
            queryClient.clear();
            await persister.removeClient();
        } catch (err) {
            console.warn('[Auth] Error clearing queryClient on logout:', err);
        }

        // 2. Clear state in store and flags
        batch(() => {
            setState('user', null);
            setState('status', 'unauthenticated');
        });
        setSessionFlag(false);

        // Invalidate cached org list
        invalidateOrgCache();

        // Reset tenant branding on global portal (in.zelys.app) so previous company branding doesn't linger
        if (typeof window !== 'undefined' && !getSubdomain()) {
            applyBranding(null);
        }

        // 3. Clear cached modules
        try {
            const { actions: moduleActions } = await import('@shared/store/modules.store');
            moduleActions.clearModules();
        } catch {}

        // 4. Invalidate router route match caches
        try {
            const { router } = await import('@/router');
            router.invalidate();
        } catch {}

        // 5. Notify other tabs via centralized broadcast
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

    // Session initialization — just call GET /me, cookie is sent automatically.
    // Deduplicated: auth.routes.tsx + router.tsx may call this concurrently.
    initSession: async (): Promise<boolean> => {
        if (state.status === 'authenticated') return true;

        // In-flight dedup: share the same /me request across concurrent callers
        if (initSessionPromise) return initSessionPromise;

        initSessionPromise = (async () => {
            setState('status', 'loading');

            try {
                // A tenant handoff is an opaque, short-lived ticket. It is
                // consumed before loading profile/RBAC so the active org is
                // established on the API session first.
                if (typeof window !== 'undefined') {
                    const url = new URL(window.location.href);
                    const handoff = url.searchParams.get('handoff');
                    if (handoff) {
                        await authApi.consumeTenantHandoff(handoff);
                        url.searchParams.delete('handoff');
                        window.history.replaceState({}, '', url.toString());
                        invalidateOrgCache();
                    }
                }
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

                // Atomic in-memory hydration of modules (0ms)
                if (Array.isArray(userData.modules)) {
                    const { actions: moduleActions } = await import('@shared/store/modules.store');
                    moduleActions.setModules(userData.modules, userData as ProfileType);
                }

                return true;
            } catch (err) {
                console.warn('[auth.store] initSession failed:', err);
                currentSessionId = null;
                setState('status', 'unauthenticated');
                setSessionFlag(false);
                return false;
            } finally {
                initSessionPromise = null;
            }
        })();

        return initSessionPromise;
    },

    /**
     * Ensures an authenticated session is active.
     * Fast-paths if already authenticated in memory; checks session hints (localStorage or URL)
     * before performing a network call to initSession.
     * Returns the authenticated user or null.
     */
    ensureSession: async (options?: { forceCheck?: boolean }): Promise<ProfileType | null> => {
        if (state.status === 'authenticated' && state.user) {
            return state.user;
        }
        const hasSessionFlag = localStorage.getItem(SESSION_FLAG_KEY);
        const hasSessionParam = typeof window !== 'undefined' && window.location.search.includes('session=true');
        if (!options?.forceCheck && !hasSessionFlag && !hasSessionParam) {
            return null;
        }
        const restored = await actions.initSession();
        if (restored && typeof window !== 'undefined' && window.location.search.includes('session=true')) {
            try {
                const cleanUrl = new URL(window.location.href);
                cleanUrl.searchParams.delete('session');
                const newSearch = cleanUrl.searchParams.toString();
                const newPath = cleanUrl.pathname + (newSearch ? `?${newSearch}` : '') + cleanUrl.hash;
                window.history.replaceState(window.history.state, '', newPath);
            } catch {}
        }
        return restored ? state.user : null;
    },

    // Refresh user session/profile data from server (silently in background)
    refreshSession: async (): Promise<boolean> => {
        try {
            const userData = await profileApi.getMe();
            // Store is reactively updated, keeping the currentSessionId and authenticated status intact
            setState('user', userData as ProfileType);
            if (Array.isArray(userData.modules)) {
                const { actions: moduleActions } = await import('@shared/store/modules.store');
                moduleActions.setModules(userData.modules, userData as ProfileType);
            }
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

        // Initialize centralized cross-tab broadcast channel before registering handlers
        broadcast.init();

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
            const { userId, username, email, name, image } = (e as CustomEvent).detail ?? {};
            if (!state.user || String(state.user.id) !== String(userId)) return;
            // Granular update — SolidJS only re-renders components that read these specific fields
            if (username !== undefined) setState('user', 'username', username);
            if (email !== undefined) setState('user', 'email', email);
            if (name !== undefined) setState('user', 'name', name);
            if (image !== undefined) setState('user', 'image', image);
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
            import('@shared/store/modules.store')
                .then((m) => m.actions.fetchModules())
                .catch(() => {});
            // Navigate if still on the login page
            // Preserve redirect param if present (e.g., /login?redirect=/suppliers → /suppliers)
            if (window.location.pathname.startsWith('/login')) {
                const { isGlobalPortalHost } = await import('@app/schema/utils');
                const safePath = getSafeRedirectPath(window.location.search);
                const isGlobal = isGlobalPortalHost(window.location.hostname);
                if (isGlobal && data.user.companySlug) {
                    const organizations = await authClient.organization.list();
                    const organization = organizations.data?.find((item) => item.slug === data.user.companySlug);
                    if (organization?.slug) {
                        const handoff = await authApi.requestTenantHandoff(organization.id, organization.slug);
                        window.location.href = buildHandoffTargetUrl(handoff.redirectUrl, safePath);
                    }
                } else {
                    window.location.href = safePath;
                }
            }
        });

        // Centralized broadcast store (profile updates from other tabs via BroadcastChannel)
        broadcast.on(BroadcastEvents.PROFILE_UPDATE, (data) => {
            if (data?.user && state.user) {
                // Granular updates only — DO NOT spread/replace the whole user object
                if (data.user.username !== undefined) setState('user', 'username', data.user.username);
                if (data.user.email !== undefined) setState('user', 'email', data.user.email);
                if (data.user.name !== undefined) setState('user', 'name', data.user.name);
                if (data.user.image !== undefined) setState('user', 'image', data.user.image);
            }
        });

        // WS: session revocation — if MY session is revoked from another tab/browser, log out.
        // sse.store dispatches this as a CustomEvent when the backend sends user:session_revoked.
        window.addEventListener('user:session_revoked', ((e: CustomEvent) => {
            const { sessionId } = e.detail ?? {};
            if (sessionId && sessionId === currentSessionId) {
                // MY session was revoked by another device — force single-flight logout
                void actions.handleUnauthorizedDrop();
            }
            // For other sessions: SessionsSection.tsx handles the list refresh via its own listener
        }) as EventListener);

        // GLOBAL 401 AUTHORIZATION DROP
        // Triggered by either the WebSocket closing with 4001/1008 or the Eden API fetcher getting a 401.
        window.addEventListener('auth:unauthorized', () => {
            console.warn('[Auth] Detected 401 drop. Executing clean single-flight auto-logout...');
            void actions.handleUnauthorizedDrop();
        });
    }
};

// --- GETTERS (Selectors) ---

const allowedModulesMemo = createRoot(() =>
    createMemo(() => resolveAllowedModulesFromFeatures(state.user?.features || {}))
);

const canModuleAction = (module: RbacModule, action?: string): boolean => {
    const u = state.user;
    if (!u || !isUsableSubscriptionStatus(u.planStatus)) return false;
    if (!allowedModulesMemo().has(module)) return false;
    if (u.roles?.includes(SYSTEM_ROLES.SUPERADMIN)) return true;
    if (!action) {
        return Boolean(u.permissions?.some(p => p.startsWith(`${module}.`)));
    }
    return u.permissions?.includes(`${module}.${action}`) || false;
};

export const useAuth = () => {
    return {
        user: () => state.user,
        isAuthenticated: () => state.status === 'authenticated',
        isLoading: () => state.status === 'loading',
        plan: () => state.user?.plan || 'free',
        planName: () => state.user?.planName ?? null,
        planStatus: () => state.user?.planStatus || 'ACTIVE',
        planPeriodEnd: () => state.user?.planPeriodEnd ?? null,
        gracePeriodEndsAt: () => state.user?.gracePeriodEndsAt ?? null,
        isSubscriptionUsable: () => isUsableSubscriptionStatus(state.user?.planStatus),
        features: () => state.user?.features || {},
        hasFeature: (featureCode: string): boolean => {
            const val = state.user?.features?.[featureCode];
            if (typeof val === 'boolean') return val;
            if (typeof val === 'number') return val > 0 || val === -1;
            return false;
        },
        canAccessModule: (module: RbacModule): boolean => canModuleAction(module),
        hasPermission: (perm: AnyPermissionSlug) => {
            const u = state.user;
            if (!u || !isUsableSubscriptionStatus(u.planStatus)) return false;
            if (u.roles?.includes(SYSTEM_ROLES.SUPERADMIN)) return true;
            return u.permissions?.includes(perm) || false;
        },
        isAdmin: () => state.user?.roles?.includes(SYSTEM_ROLES.SUPERADMIN) || false,
        hasRole: (role: string) => state.user?.roles?.includes(role) || false,
        canRead: (module: RbacModule) => canModuleAction(module, 'read'),
        canAdd: (module: RbacModule) => canModuleAction(module, 'create'),
        canEdit: (module: RbacModule) => canModuleAction(module, 'update'),
        canDelete: (module: RbacModule) => canModuleAction(module, 'delete'),
        canRestore: (module: RbacModule) => canModuleAction(module, 'restore'),
        canDestroy: (module: RbacModule) => canModuleAction(module, 'destroy'),
        can: <M extends RbacModule>(module: M, action: ActionsForModule<M>) => canModuleAction(module, action),
    };
};
