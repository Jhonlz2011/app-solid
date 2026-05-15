import { createSignal, onCleanup } from "solid-js";

/**
 * SSR-safe media query hook.
 * Returns a reactive accessor that updates when the media query matches change.
 */
export function useMediaQuery(query: string): () => boolean {
    const [matches, setMatches] = createSignal(
        typeof window !== "undefined" ? window.matchMedia(query).matches : false
    );

    if (typeof window !== "undefined") {
        const media = window.matchMedia(query);

        // Update signal on media query changes
        const listener = (e: MediaQueryListEvent) => setMatches(e.matches);
        media.addEventListener("change", listener);

        // Cleanup listener on component unmount
        onCleanup(() => media.removeEventListener("change", listener));
    }

    return matches;
}