import { createStore } from "solid-js/store";
import { api } from "../lib/eden";
import { useAuth } from "@modules/auth/store/auth.store";
import type { MenuItemStatus } from "@app/schema/enums";
import { setRouteAliases, resetRouteAliases } from "@shared/utils/route-alias";
import { RealtimeEvents } from "@app/schema/realtime-events";

function notifyRouterOfAliasChange(): void {
    if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('route-aliases:updated'));
        import('@/router').then(m => {
            m.router?.invalidate();
        }).catch(() => {});
    }
}

function syncRouteAliases(modules: ModuleConfig[], tenantSlug?: string | null): void {
    const aliasMap: Record<string, string> = {};
    const traverse = (items: ModuleConfig[]) => {
        for (const item of items) {
            if (item.path && item.pathAlias && item.path !== item.pathAlias) {
                aliasMap[item.pathAlias] = item.path;
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
}

if (typeof window !== 'undefined') {
    window.addEventListener(RealtimeEvents.MENU.UPDATED, () => {
        actions.refreshModules();
    });
}

export interface ModuleConfig {
    key: string;
    label: string;
    icon?: string;
    path?: string;
    pathAlias?: string;
    permission?: string;
    status?: MenuItemStatus;
    children?: ModuleConfig[];
}

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
                syncRouteAliases(modulesList, currentTenant);
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
        syncRouteAliases(modulesList, currentTenant);

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