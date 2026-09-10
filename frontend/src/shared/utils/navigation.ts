import { router } from '@/router';
import type { NavigateOptions } from '@tanstack/solid-router';

/**
 * Universal safe router navigation.
 * Uses TanStack Router's native href navigation which automatically invokes
 * rewrite.input to resolve tenant aliases to canonical internal routes.
 */
export function navigateSafely(
    targetPath: string,
    options?: Omit<NavigateOptions, 'to' | 'href'>
): Promise<void> {
    return router.navigate({
        href: targetPath,
        ...options,
    });
}
