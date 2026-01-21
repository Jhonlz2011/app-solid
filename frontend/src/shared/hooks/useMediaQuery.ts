import { createSignal, onCleanup } from "solid-js";

// Singleton cache for media queries to avoid duplicate listeners
const mediaQueryCache = new Map<string, () => boolean>();

/**
 * SSR-safe media query hook with caching
 * Returns a reactive accessor that updates when the media query matches change
 */
export function useMediaQuery(query: string): () => boolean {
    // Return cached accessor if already created for this query
    if (mediaQueryCache.has(query)) {
        return mediaQueryCache.get(query)!;
    }

    // Initialize with current match state (SSR-safe)
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

    // Cache the accessor for reuse
    mediaQueryCache.set(query, matches);

    return matches;
}