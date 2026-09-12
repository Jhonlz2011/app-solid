import { createStore } from "solid-js/store";
import { createMemo, type Accessor } from "solid-js";
import { useLocation } from "@tanstack/solid-router";
import { api } from "../lib/eden";
import { useAuth } from "@modules/auth/store/auth.store";
import type { ModuleConfig } from "@app/schema/backend";
import { setRouteAliases, setRouteLabels, getPreloadedRouteLabel, toRealPath, resetRouteAliases } from "@shared/utils/route-alias";
import { RealtimeEvents } from "@app/schema/realtime-events";

function notifyRouterOfAliasChange(): void {
    if (typeof window !== 'undefined') {
        import('@/router').then(m => {
            m.router?.invalidate();
        }).catch(() => {});
    }
}

function syncRouteMetadata(modules: ModuleConfig[], tenantSlug?: string | null): void {
    const aliasMap: Record<string, string> = {};
    const labelMap: Record<string, string> = {};

    const traverse = (items: ModuleConfig[]) => {
        for (const item of items) {
            if (item.path && item.label) {
                labelMap[item.path] = item.label;
            }
            if (item.path && item.pathAlias && item.path !== item.pathAlias) {
                aliasMap[item.pathAlias] = item.path;
                if (item.label) {
                    labelMap[item.pathAlias] = item.label;
                }
            }
            if (item.children?.length) {
                traverse(item.children);
            }
        }
    };
    traverse(modules);
    if (Object.keys(aliasMap).length > 0) {
        setRouteAliases(aliasMap, tenantSlug);
        notifyRouterOfAliasChange();
    }
    if (Object.keys(labelMap).length > 0) {
        setRouteLabels(labelMap, tenantSlug);
    }
}

if (typeof window !== 'undefined') {
    window.addEventListener(RealtimeEvents.MENU.UPDATED, () => {
        actions.refreshModules();
    });
}

export type { ModuleConfig } from "@app/schema/backend";

interface ModulesState {
    modules: ModuleConfig[];
    isLoading: boolean;
    error: string | null;
    cachedKey: string | null;  // Compound key: `${userId}:${companySlug}`
}

const [state, setState] = createStore<ModulesState>({
    modules: [],
    isLoading: false,
    error: null,
    cachedKey: null,
});

// Cached promise to prevent duplicate concurrent requests
let fetchPromise: Promise<void> | null = null;

export const actions = {
    fetchModules: async () => {
        const auth = useAuth();
        const user = auth.user();
        const currentUserId = user?.id ? String(user.id) : null;
        const currentTenant = user?.companySlug || (user?.companyId ? String(user.companyId) : null);
        const cacheKey = currentUserId ? `${currentUserId}:${currentTenant || 'global'}` : null;

        // Reuse existing request if in progress
        if (fetchPromise) {
            return fetchPromise;
        }

        // Skip if already loaded for the exact same user + tenant context
        if (
            state.modules.length > 0 &&
            !state.error &&
            cacheKey !== null &&
            state.cachedKey === cacheKey
        ) {
            return;
        }

        setState("isLoading", true);
        fetchPromise = (async () => {
            try {
                const { data, error } = await api.modules.tree.get();
                if (error) throw new Error(String(error.value));
                const modulesList = Array.isArray(data) ? data as ModuleConfig[] : [];
                syncRouteMetadata(modulesList, currentTenant);
                setState({
                    modules: modulesList,
                    error: null,
                    cachedKey: cacheKey,
                });
            } catch (err) {
                console.error('Error fetching modules:', err);
                setState({
                    error: err instanceof Error ? err.message : 'Error desconocido',
                    modules: [],
                    cachedKey: null,
                });
            } finally {
                setState("isLoading", false);
                fetchPromise = null;
            }
        })();

        return fetchPromise;
    },

    // Direct in-memory atomic hydration (from getMe() single-flight payload)
    setModules: (modules: ModuleConfig[], user?: { id?: string | number; companySlug?: string | null; companyId?: number | null }) => {
        const currentUserId = user?.id ? String(user.id) : null;
        const currentTenant = user?.companySlug || (user?.companyId ? String(user.companyId) : null);
        const cacheKey = currentUserId ? `${currentUserId}:${currentTenant || 'global'}` : null;

        const modulesList = Array.isArray(modules) ? modules : [];
        syncRouteMetadata(modulesList, currentTenant);

        fetchPromise = null;
        setState({
            modules: modulesList,
            error: null,
            isLoading: false,
            cachedKey: cacheKey,
        });
    },

    // Clear modules cache (for logout and tenant switch)
    clearModules: () => {
        fetchPromise = null;  // Reset any pending promise
        resetRouteAliases();
        setState({
            modules: [],
            error: null,
            isLoading: false,
            cachedKey: null,
        });
    },

    // Force refresh (bypass cache check)
    refreshModules: async () => {
        fetchPromise = null;
        setState({ modules: [], error: null, cachedKey: null });
        return actions.fetchModules();
    }
};

export const useModules = () => {
    return {
        modules: () => state.modules,
        isLoading: () => state.isLoading,
        error: () => state.error,
        refreshModules: actions.refreshModules
    };
};

/**
 * Recursively search a module by key or permission across the module tree.
 */
export function findModuleByKey(items: ModuleConfig[], key: string): ModuleConfig | undefined {
    for (const item of items) {
        if (item.key === key || item.permission === key) {
            return item;
        }
        if (item.children?.length) {
            const found = findModuleByKey(item.children, key);
            if (found) return found;
        }
    }
    return undefined;
}

/**
 * Recursively search a module by URL path (canonical or alias) across the module tree.
 */
export function findModuleByPath(items: ModuleConfig[], rawPath: string): ModuleConfig | undefined {
    const canonical = toRealPath(rawPath);
    const cleanPath = canonical.split('?')[0].split('#')[0];
    const normalized = cleanPath.length > 1 && cleanPath.endsWith('/') ? cleanPath.slice(0, -1) : cleanPath;

    for (const item of items) {
        if (item.path) {
            const itemClean = item.path.split('?')[0].split('#')[0];
            const itemNormalized = itemClean.length > 1 && itemClean.endsWith('/') ? itemClean.slice(0, -1) : itemClean;
            if (normalized === itemNormalized || normalized.startsWith(`${itemNormalized}/`)) {
                return item;
            }
        }
        if (item.children?.length) {
            const found = findModuleByPath(item.children, rawPath);
            if (found) return found;
        }
    }
    return undefined;
}

/**
 * Resolves the currently active module config based on moduleKey or the current route.
 */
export function useCurrentModule(moduleKey?: string | (() => string | undefined)): Accessor<ModuleConfig | undefined> {
    const { modules } = useModules();
    let location: ReturnType<typeof useLocation> | null = null;
    try {
        location = useLocation();
    } catch {
        // Outside router context
    }

    return createMemo(() => {
        const allModules = modules();
        if (allModules.length === 0) return undefined;

        const key = typeof moduleKey === 'function' ? moduleKey() : moduleKey;
        if (key) {
            const found = findModuleByKey(allModules, key);
            if (found) return found;
        }

        const currentPath = (location ? location().pathname : undefined) || (typeof window !== 'undefined' ? window.location.pathname : '');
        if (currentPath) {
            return findModuleByPath(allModules, currentPath);
        }

        return undefined;
    });
}

/**
 * Universally resolves the dynamic tenant page title with 3-tier precedence:
 * 1. Live reactive module label from SolidJS store (real-time SSE updates)
 * 2. Pre-injected DOM script tag / LocalStorage cache (0ms Frame 1 FCP on F5 reload)
 * 3. Static fallback title provided by component
 */
export function useModuleTitle(
    fallbackTitle: string | (() => string),
    moduleKey?: string | (() => string | undefined)
): Accessor<string> {
    const { modules } = useModules();
    let location: ReturnType<typeof useLocation> | null = null;
    try {
        location = useLocation();
    } catch {
        // Outside router context
    }

    return createMemo(() => {
        const fallback = typeof fallbackTitle === 'function' ? fallbackTitle() : fallbackTitle;
        const key = typeof moduleKey === 'function' ? moduleKey() : moduleKey;
        const currentPath = (location ? location().pathname : undefined) || (typeof window !== 'undefined' ? window.location.pathname : '');

        // Tier 1: Active loaded modules in reactive Solid store
        const allModules = modules();
        if (allModules.length > 0) {
            if (key) {
                const foundByKey = findModuleByKey(allModules, key);
                if (foundByKey?.label) return foundByKey.label;
            }
            if (currentPath) {
                const foundByPath = findModuleByPath(allModules, currentPath);
                if (foundByPath?.label) return foundByPath.label;
            }
        }

        // Tier 2: Pre-boot injected route label (0ms on F5 hard refresh before getMe resolves)
        if (currentPath) {
            const preloaded = getPreloadedRouteLabel(currentPath);
            if (preloaded) return preloaded;
        }

        // Tier 3: Static fallback title
        return fallback;
    });
}