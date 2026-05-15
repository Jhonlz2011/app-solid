export const locationKeys = {
    all: ['locations'] as const,
    lists: () => [...locationKeys.all, 'list'] as const,
};
