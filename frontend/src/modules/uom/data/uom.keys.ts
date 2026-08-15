export const uomKeys = {
    all: ['uom'] as const,
    lists: () => [...uomKeys.all, 'list'] as const,
    detail: (id: number) => [...uomKeys.all, 'detail', id] as const,
    references: (id: number) => [...uomKeys.all, 'references', id] as const,
};
