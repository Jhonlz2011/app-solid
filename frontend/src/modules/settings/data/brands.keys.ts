export const brandKeys = {
    all: ['settings', 'brands'] as const,
    detail: (id: number) => [...brandKeys.all, 'detail', id] as const,
};
