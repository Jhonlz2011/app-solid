export const vehicleKeys = {
    all: ['vehicles'] as const,
    list: () => [...vehicleKeys.all, 'list'] as const,
    detail: (id: number) => [...vehicleKeys.all, 'detail', id] as const,
};
