export const categorieKeys = {
    categories: ['catalogs', 'categories'] as const,
    categoriesTree: () => [...categorieKeys.categories, 'tree'] as const,
    categoriesFlat: () => [...categorieKeys.categories, 'flat'] as const,
    /** Alias for SSE invalidation consistency */
    list: () => categorieKeys.categoriesFlat(),
    brands: ['catalogs', 'brands'] as const,
    uom: ['catalogs', 'uom'] as const,

    categoryDetail: (id: number) => [...categorieKeys.categories, 'detail', id] as const,
    categoryFormSchema: (id: number) => [...categorieKeys.categories, 'form-schema', id] as const,
    references: (id: number) => [...categorieKeys.categories, 'references', id] as const,
};
