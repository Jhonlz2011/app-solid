export const warehouseKeys = {
    warehouses: ['inventory', 'warehouses'] as const,
    warehouseDetail: (id: number) => [...warehouseKeys.warehouses, 'detail', id] as const,

    locations: ['inventory', 'locations'] as const,
    locationsByWarehouse: (warehouseId: number) => [...warehouseKeys.locations, 'warehouse', warehouseId] as const,
};
