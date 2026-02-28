import { createSignal } from 'solid-js';
import { useNavigate } from '@tanstack/solid-router';
import { actions as authActions } from '@modules/auth/store/auth.store';

export function useLogout() {
    const navigate = useNavigate();
    const [isLoggingOut, setIsLoggingOut] = createSignal(false);

    const handleLogout = async () => {
        setIsLoggingOut(true);
        try {
            // Navigate FIRST to unmount the sidebar/layout before clearing reactive state.
            // This prevents the visual flash where module names and username disappear
            // for a few milliseconds due to SolidJS granular reactivity.
            navigate({ to: '/login', search: { redirect: undefined } });
            await authActions.logout();
        } finally {
            setIsLoggingOut(false);
        }
    };

    return { handleLogout, isLoggingOut };
}
