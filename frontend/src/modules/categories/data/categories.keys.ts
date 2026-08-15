export const categoryKeys = {
    categories: ['catalogs', 'categories'] as const,
    categoriesTree: () => [...categoryKeys.categories, 'tree'] as const,
    categoriesFlat: () => [...categoryKeys.categories, 'flat'] as const,
    /** Alias for SSE invalidation consistency */
    list: () => categoryKeys.categoriesFlat(),
    brands: ['catalogs', 'brands'] as const,
    uom: ['catalogs', 'uom'] as const,

    categoryDetail: (id: number) => [...categoryKeys.categories, 'detail', id] as const,
    categoryFormSchema: (id: number) => [...categoryKeys.categories, 'form-schema', id] as const,
    references: (id: number) => [...categoryKeys.categories, 'references', id] as const,
};

// Backwards-compatible alias for existing consumers
export const categorieKeys = categoryKeys;
