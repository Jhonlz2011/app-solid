export const locationKeys = {
    all: ['locations'] as const,
    list: () => [...locationKeys.all, 'list'] as const,
    references: (id: number) => [...locationKeys.all, 'references', id] as const,
};
