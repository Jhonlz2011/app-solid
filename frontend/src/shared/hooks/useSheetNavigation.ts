import { useNavigate, useParentMatches } from '@tanstack/solid-router';

interface SheetNavigationProps {
    onClose?: () => void;

}

/**
 * Centralises the dismiss / close / back navigation pattern
 * that was duplicated across every Sheet component.
 *
 * Usage:
 *   const { bindDismiss, close } = useSheetNavigation(props);
 *
 *   <Sheet bindDismiss={bindDismiss} isOpen={true} onClose={close} ...>
 *
 * Behaviour:
 *   - close() → triggers the Sheet exit animation (via dismissFn), then calls
 *               onClose → navigate('..')  in that priority order.
 *   - bindDismiss → wires up the internal Sheet dismiss function so the
 *                   animation always runs before actual navigation.
 */
export function useSheetNavigation(props: SheetNavigationProps) {
    const navigate = useNavigate();
    const parentMatches = useParentMatches(); // signal: () => RouteMatch[]
    let dismissFn: (() => void) | undefined;

    /** Called by <Sheet bindDismiss={...}> to expose the animated dismiss fn */
    const bindDismiss = (fn: () => void) => {
        dismissFn = fn;
    };

    /**
     * Navigates "away" without animation — used as the Sheet's onClose prop
     * so overlay-click and X-button also call the right handler.
     */
     const navigateAway = () => {

        if (props.onClose) return props.onClose();

        // Fallback genérico: sube al padre en el ÁRBOL DE RUTAS,
        // no al "path menos un segmento". Esto resuelve
        //   /products/new/categories/new -> /products/new
        // en vez de -> /products/new/categories (ruta inexistente),
        // sin importar cuántos segmentos de URL ocupe el `path`
        // de la ruta hija (categories/new cuenta como UNA sola ruta).
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
        if (dismissFn) dismissFn();
        else navigateAway();
    };

    return { bindDismiss, close, navigateAway };
}
