export const menuKeys = {
    all: ['modules-menu'] as const,
    list: () => [...menuKeys.all, 'list'] as const,
    tree: () => [...menuKeys.all, 'tree'] as const,
    detail: (id: number) => [...menuKeys.all, 'detail', id] as const,
};
