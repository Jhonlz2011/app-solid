export const locationKeys = {
    all: ['locations'] as const,
    list: () => [...locationKeys.all, 'list'] as const,
    listByWarehouse: (warehouseId?: number) => [...locationKeys.all, 'list', { warehouseId }] as const,
    detail: (id: number) => [...locationKeys.all, 'detail', id] as const,
    references: (id: number) => [...locationKeys.all, 'references', id] as const,
};
