import { createStore } from "solid-js/store";
import { api } from "../lib/eden";
import { useAuth } from "@modules/auth/store/auth.store";
import type { MenuItemStatus } from "@app/schema/enums";

export interface ModuleConfig {
    key: string;
    label: string;
    icon?: string;
    path?: string;
    permission?: string;
    status?: MenuItemStatus;
    children?: ModuleConfig[];
}

interface ModulesState {
    modules: ModuleConfig[];
    isLoading: boolean;
    error: string | null;
    cachedForUserId: string | null;  // string: user.id es UUIDv7, no number
}

const [state, setState] = createStore<ModulesState>({
    modules: [],
    isLoading: false,
    error: null,
    cachedForUserId: null,
});

// Cached promise to prevent duplicate concurrent requests
let fetchPromise: Promise<void> | null = null;

export const actions = {
    fetchModules: async () => {
        const auth = useAuth();
        // user.id es string (UUIDv7) — comparar como string
        const currentUserId = auth.user()?.id ? String(auth.user()!.id) : null;

        // Reuse existing request if in progress
        if (fetchPromise) {
            return fetchPromise;
        }

        // Skip if already loaded for the same user
        if (
            state.modules.length > 0 &&
            !state.error &&
            currentUserId !== null &&
            state.cachedForUserId === currentUserId
        ) {
            return;
        }

        // NOTA: No verificamos auth.isAuthenticated() aquí porque este método se llama
        // desde el router loader que ya garantiza que beforeLoad pasó exitosamente.
        // Verificar isAuthenticated() en el loader puede dar false si se corre en paralelo.
        // Si no hay userId disponible aún, igual procedemos (el API retornará 401 si no hay sesión).

        setState("isLoading", true);
        fetchPromise = (async () => {
            try {
                const { data, error } = await api.modules.tree.get();
                if (error) throw new Error(String(error.value));
                setState({
                    modules: Array.isArray(data) ? data as ModuleConfig[] : [],
                    error: null,
                    cachedForUserId: currentUserId,
                });
            } catch (err) {
                console.error('Error fetching modules:', err);
                setState({
                    error: err instanceof Error ? err.message : 'Error desconocido',
                    modules: [],
                    cachedForUserId: null,
                });
            } finally {
                setState("isLoading", false);
                fetchPromise = null;
            }
        })();

        return fetchPromise;
    },

    // Clear modules cache (for logout)
    clearModules: () => {
        fetchPromise = null;  // Reset any pending promise
        setState({
            modules: [],
            error: null,
            isLoading: false,
            cachedForUserId: null,
        });
    },

    // Force refresh (bypass cache check)
    refreshModules: async () => {
        fetchPromise = null;
        setState({ modules: [], error: null, cachedForUserId: null });
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