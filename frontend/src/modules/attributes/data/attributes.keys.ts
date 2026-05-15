export const attributeKeys = {
    all: ['attributes'] as const,
    detail: (id: number) => [...attributeKeys.all, 'detail', id] as const,
};
