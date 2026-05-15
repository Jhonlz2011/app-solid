export const uomKeys = {
    all: ['uom'] as const,
    lists: () => [...uomKeys.all, 'list'] as const,
};
