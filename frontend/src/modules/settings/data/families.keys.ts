export const familyKeys = {
    all: ['settings', 'families'] as const,
    detail: (id: number) => [...familyKeys.all, 'detail', id] as const,
};
