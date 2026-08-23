/**
 * createTabErrorSelector — Centralized tab-error detection for multi-tab forms.
 *
 * Given a mapping of tab names to field prefixes, builds a TanStack Form
 * `selector` function that returns a Record<string, boolean> indicating
 * which tabs have visible errors.
 *
 * This is the same pattern used in EntityForm but extracted for reuse
 * across EntityForm, CatalogForm, and any future multi-tab forms.
 *
 * @example
 * ```tsx
 * const selector = createTabErrorSelector(hasAttemptedSubmit, {
 *   general: { prefixes: [], isDefault: true },
 *   contacts: { prefixes: ['contacts'] },
 *   addresses: { prefixes: ['addresses'] },
 * });
 *
 * <form.Subscribe selector={selector}>
 *   {(flagsAccessor) => {
 *     const flags = resolveTabFlags(flagsAccessor);
 *     return <TabsTrigger hasError={flags.general}>General</TabsTrigger>;
 *   }}
 * </form.Subscribe>
 * ```
 */

export interface TabConfig {
    /** Field name prefixes that belong to this tab. */
    prefixes: string[];
    /** If true, this tab catches all fields NOT matched by any other tab. */
    isDefault?: boolean;
}

/**
 * Creates a selector function compatible with `form.Subscribe`.
 * Returns `Record<string, boolean>` where each key is a tab name
 * and the value indicates whether that tab has visible errors.
 */
export function createTabErrorSelector<TTabs extends Record<string, TabConfig>>(
    hasAttemptedSubmit: () => boolean,
    tabs: TTabs,
): (state: any) => Record<keyof TTabs, boolean> {
    // Pre-compute the list of all non-default prefixes for the default tab exclusion
    const allPrefixes: string[] = [];
    for (const config of Object.values(tabs) as TabConfig[]) {
        if (!config.isDefault) {
            allPrefixes.push(...config.prefixes);
        }
    }

    return (state: any) => {
        const meta = (state.fieldMeta || {}) as Record<string, {
            errors?: unknown[];
            errorMap?: { onSubmit?: string };
            isTouched?: boolean;
        }>;
        const keys = Object.keys(meta);
        const isAttempted = state.isSubmitted || hasAttemptedSubmit();

        const isErrVisible = (k: string): boolean => {
            const f = meta[k];
            if (!f?.errors || f.errors.length === 0) return false;
            const hasSubmitError = f.errorMap?.onSubmit !== undefined;
            return f.isTouched || isAttempted || hasSubmitError;
        };

        const matchesPrefix = (key: string, prefixes: string[]): boolean =>
            prefixes.some(p => key.startsWith(p));

        const result = {} as Record<keyof TTabs, boolean>;
        for (const [tabName, config] of Object.entries(tabs) as [keyof TTabs & string, TabConfig][]) {
            if (config.isDefault) {
                // Default tab: fields NOT matched by any other tab's prefixes
                result[tabName] = keys.some(k => !matchesPrefix(k, allPrefixes) && isErrVisible(k));
            } else {
                result[tabName] = keys.some(k => matchesPrefix(k, config.prefixes) && isErrVisible(k));
            }
        }

        return result;
    };
}

/**
 * Safely resolves a `form.Subscribe` accessor (may be function or raw value)
 * into the tab flags record with a fallback of all-false.
 */
export function resolveTabFlags<T extends Record<string, boolean>>(
    accessor: T | (() => T) | undefined
): T {
    if (!accessor) return {} as T;
    const val = typeof accessor === 'function' ? (accessor as () => T)() : accessor;
    return val || ({} as T);
}

/**
 * useTabErrors — Custom hook for clean, reactive multi-tab error detection.
 * Subscribes directly to form state via `form.useStore` without needing JSX wrappers.
 */
export function useTabErrors<TTabs extends Record<string, TabConfig>>(
    form: { useStore: <T>(selector: (state: any) => T) => () => T },
    hasAttemptedSubmit: () => boolean,
    tabs: TTabs
): () => Record<keyof TTabs, boolean> {
    const selector = createTabErrorSelector(hasAttemptedSubmit, tabs);
    return form.useStore(selector);
}
