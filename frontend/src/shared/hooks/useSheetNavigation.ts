import { useNavigate } from '@tanstack/solid-router';

interface SheetNavigationProps {
    onClose?: () => void;
    onBack?: () => void;
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
 *               onBack → onClose → navigate('..')  in that priority order.
 *   - bindDismiss → wires up the internal Sheet dismiss function so the
 *                   animation always runs before actual navigation.
 */
export function useSheetNavigation(props: SheetNavigationProps) {
    const navigate = useNavigate();
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
        if (props.onBack) props.onBack();
        else if (props.onClose) props.onClose();
        else navigate({ to: '..', search: true });
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
