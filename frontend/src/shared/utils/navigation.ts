import { router } from '@/router';
import { redirect, type NavigateOptions } from '@tanstack/solid-router';
import { toRealPath } from './route-alias';

/**
 * Parses any raw path or alias URL into canonical internal route + search object + hash.
 * Handles user-facing aliases, query strings, and hashes using standard URL API.
 */
function resolveRouteParts(targetPath: string) {
    const url = new URL(targetPath, 'http://dummy.local');
    const canonical = toRealPath(url.pathname);
    const search = url.search ? Object.fromEntries(url.searchParams.entries()) : undefined;
    const hash = url.hash ? url.hash.slice(1) : undefined;
    return { canonical, search, hash };
}

/**
 * Universal safe router navigation for UI actions and handlers.
 * Resolves user-facing aliases to canonical routes before handing off to TanStack Router.
 * The rewrite.output subsystem automatically displays the correct alias in the URL bar.
 */
export function navigateSafely(
    targetPath: string,
    options?: Omit<NavigateOptions, 'to' | 'href'>
): Promise<void> {
    const { canonical, search, hash } = resolveRouteParts(targetPath);
    return router.navigate({
        to: canonical as any,
        search: search ? (prev: any) => ({ ...prev, ...search }) : undefined,
        hash,
        ...options,
    });
}

/**
 * Universal safe router redirect for route guards (beforeLoad / loader).
 * Resolves user-facing aliases to canonical routes before throwing TanStack Router's redirect.
 */
export function redirectSafely(targetPath: string) {
    const { canonical, search, hash } = resolveRouteParts(targetPath);
    return redirect({
        to: canonical as any,
        search: search as any,
        hash,
    });
}

