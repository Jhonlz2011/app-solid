import { createSignal } from 'solid-js';
import { useNavigate } from '@tanstack/solid-router';
import { actions as authActions } from '@modules/auth/store/auth.store';
import { queryClient } from '@shared/lib/queryClient';

export function useLogout() {
    const navigate = useNavigate();
    const [isLoggingOut, setIsLoggingOut] = createSignal(false);

    const handleLogout = async () => {
        setIsLoggingOut(true);
        try {
            // 1. Clear cached query data securely
            queryClient.clear();
            // 2. Clear local auth state and notify server
            await authActions.logout();
            // 3. Perform fluid client-side SPA navigation to login
            navigate({ to: '/login', search: { redirect: undefined }, replace: true });
        } finally {
            setIsLoggingOut(false);
        }
    };
    return { handleLogout, isLoggingOut };
}
