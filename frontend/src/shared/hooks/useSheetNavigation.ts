import { useNavigate, useRouter } from '@tanstack/solid-router';

export interface SheetNavigationProps {
    onClose?: () => void;
    /** Optional dirty state accessor to guard against losing unsaved changes */
    isDirty?: () => boolean;
    /** Custom confirmation prompt */
    confirmMessage?: string;
}

/**
 * Centralises the dismiss / close / back navigation pattern
 * that was duplicated across every Sheet component.
 *
 * Features:
 *   - Automatic exit animation coordination via bindDismiss.
 *   - Unsaved changes protection via isDirty guard.
 *   - Safe route tree parent navigation fallback without stale reactive subscriptions.
 *   - Idempotent close guard to prevent double-navigation during exit transitions.
 */
export function useSheetNavigation(props: SheetNavigationProps) {
    const navigate = useNavigate();
    const router = useRouter();
    let dismissFn: (() => void) | undefined;
    let isClosing = false;

    /** Called by <Sheet bindDismiss={...}> to expose the animated dismiss fn */
    const bindDismiss = (fn: () => void) => {
        dismissFn = fn;
    };

    /** Checks if navigation can proceed or if dirty warning is required */
    const canProceed = (): boolean => {
        if (props.isDirty?.()) {
            const message = props.confirmMessage ?? 'Tienes cambios sin guardar. ¿Estás seguro de que deseas salir?';
            return window.confirm(message);
        }
        return true;
    };

    /**
     * Navigates away to parent route — called after exit animation completes
     * or as fallback when no animation is available.
     */
    const navigateAway = () => {
        if (!canProceed()) return;
        if (isClosing) return;
        isClosing = true;

        if (props.onClose) {
            props.onClose();
            return;
        }

        // Safe imperative fallback: navigate to parent in route tree without subscribing to dying matches
        try {
            const matches = router.state.matches;
            if (matches.length >= 2) {
                const parentMatch = matches[matches.length - 2];
                if (parentMatch?.pathname) {
                    navigate({ to: parentMatch.pathname, search: true });
                    return;
                }
            }
            navigate({ to: '..', search: true });
        } catch {
            navigate({ to: '..', search: true });
        }
    };

    /**
     * Primary close entry-point — runs the exit animation first,
     * then delegates to navigateAway once the animation completes.
     * Use this for Cancel buttons, Close buttons and programmatic closes.
     */
    const close = () => {
        if (!canProceed()) return;

        if (dismissFn) {
            dismissFn();
        } else {
            navigateAway();
        }
    };

    return { bindDismiss, close, navigateAway };
}
