export const warehouseKeys = {
    warehouses: ['inventory', 'warehouses'] as const,
    warehouseDetail: (id: number) => [...warehouseKeys.warehouses, 'detail', id] as const,
};
