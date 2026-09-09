import { router } from '@/router';
import { toRealPath, toAliasPath } from './route-alias';
import type { NavigateOptions } from '@tanstack/solid-router';

/**
 * Universal safe router navigation.
 * Translates any user-facing alias or raw path to its canonical route
 * before passing to TanStack Router, preventing internal route-matching misses (404),
 * while keeping the browser URL bar masked with the user-facing alias.
 */
export function navigateSafely(
    targetPath: string,
    options?: Omit<NavigateOptions, 'to' | 'href'>
): Promise<void> {
    const canonicalPath = toRealPath(targetPath);
    const visibleAlias = toAliasPath(canonicalPath);

    return router.navigate({
        href: visibleAlias,
        to: canonicalPath as any,
        ...options,
    });
}
