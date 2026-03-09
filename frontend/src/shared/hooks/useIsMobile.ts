import { useMediaQuery } from './useMediaQuery';

/**
 * Reactive mobile breakpoint hook.
 * Returns true when viewport width is less than 768px (< md in Tailwind).
 */
export function useIsMobile(): () => boolean {
    return useMediaQuery('(max-width: 767px)');
}
