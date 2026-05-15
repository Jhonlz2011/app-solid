export const attributeKeys = {
    attributes: ['settings', 'attributes'] as const,
    attributeDetail: (id: number) => [...attributeKeys.attributes, 'detail', id] as const,
};
