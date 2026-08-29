import { useNavigate, useParentMatches } from '@tanstack/solid-router';

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
 *   - Safe route tree parent navigation fallback.
 */
export function useSheetNavigation(props: SheetNavigationProps) {
    const navigate = useNavigate();
    const parentMatches = useParentMatches(); // signal: () => RouteMatch[]
    let dismissFn: (() => void) | undefined;

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
     * Navigates "away" without animation — used as the Sheet's onClose prop
     * so overlay-click and X-button also call the right handler.
     */
    const navigateAway = () => {
        if (!canProceed()) return;

        if (props.onClose) return props.onClose();

        // Fallback genérico: sube al padre en el ÁRBOL DE RUTAS
        const matches = parentMatches();
        const immediateParent = matches[matches.length - 1];

        if (immediateParent) {
            navigate({ to: immediateParent.pathname, search: true });
        } else {
            navigate({ to: '/', search: true });
        }
    };

    /**
     * Primary close entry-point — runs the exit animation first,
     * then delegates to navigateAway once the animation completes.
     * Use this for Cancel buttons and programmatic closes.
     */
    const close = () => {
        if (!canProceed()) return;

        if (dismissFn) dismissFn();
        else navigateAway();
    };

    return { bindDismiss, close, navigateAway };
}
