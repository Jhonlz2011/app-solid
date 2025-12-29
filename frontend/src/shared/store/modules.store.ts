import { createStore } from "solid-js/store";
import { request } from "../lib/http";
import { useAuth } from "@modules/auth/auth.store";

export interface ModuleConfig {
    key: string;
    label: string;
    icon?: string;
    path?: string;
    permission?: string;
    children?: ModuleConfig[];
}

interface ModulesState {
    modules: ModuleConfig[];
    isLoading: boolean;
    error: string | null;
}

const [state, setState] = createStore<ModulesState>({
    modules: [],
    isLoading: false,
    error: null,
});

export const actions = {
    fetchModules: async () => {
        const auth = useAuth();
        if (!auth.isAuthenticated()) {
            setState({ modules: [], isLoading: false });
            return;
        }

        setState("isLoading", true);
        try {
            const menuTree = await request<ModuleConfig[]>('/modules/tree');
            setState({ modules: menuTree, error: null });
        } catch (err) {
            console.error('Error fetching modules:', err);
            setState({
                error: err instanceof Error ? err.message : 'Error desconocido',
                modules: []
            });
        } finally {
            setState("isLoading", false);
        }
    },

    clearModules: () => {
        setState({ modules: [], error: null, isLoading: false });
    }
};

export const useModules = () => {
    return {
        modules: () => state.modules,
        isLoading: () => state.isLoading,
        error: () => state.error,
        refreshModules: actions.fetchModules
    };
};
