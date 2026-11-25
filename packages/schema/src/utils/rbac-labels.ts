import type { RbacAction, RbacModule } from '../enums';

export const RBAC_ACTION_LABELS: Record<RbacAction, string> = {
    read: 'Ver',
    create: 'Crear',
    update: 'Editar',
    delete: 'Desactivar',
    restore: 'Restaurar',
    destroy: 'Eliminar',
    export: 'Exportar',
    import: 'Importar',
    assign: 'Asignar',
    unassign: 'Quitar',
};

export const RBAC_MODULE_LABELS: Record<RbacModule, string> = {
    dashboard: 'Panel de control',
    audit: 'Auditoría',
    system: 'Sistema',
    config: 'Configuración general',
    companies: 'Empresas y suscripción',
    menu: 'Menú y navegación',
    permissions: 'Permisos',
    roles: 'Roles',
    users: 'Usuarios',
    crm: 'CRM y ventas',
    clients: 'Clientes',
    visits: 'Visitas técnicas',
    budgets: 'Presupuestos',
    invoices: 'Facturación',
    products: 'Productos',
    services: 'Servicios',
    categories: 'Categorías',
    brands: 'Marcas',
    uom: 'Unidades de medida',
    attributes: 'Atributos de producto',
    inventory: 'Inventario',
    movements: 'Movimientos de inventario',
    orders: 'Pedidos de material',
    reception_materials: 'Recepción de mercadería',
    locations: 'Ubicaciones y bodegas',
    remission_guides: 'Guías de remisión',
    tools: 'Inventario de herramientas',
    tool_loans: 'Préstamos de herramientas',
    stock_taking: 'Toma de inventario físico',
    suppliers: 'Proveedores',
    purchase_quotes: 'Cotizaciones de compra',
    purchase_orders: 'Órdenes de compra',
    purchase_invoices: 'Facturas de compra',
    retentions: 'Retenciones',
    documents: 'Documentos electrónicos SRI',
    receivable: 'Cuentas por cobrar',
    payable: 'Cuentas por pagar',
    pos: 'Punto de venta (POS)',
    pos_sell: 'Caja POS',
    pos_sessions: 'Sesiones de caja POS',
    pos_history: 'Historial de ventas POS',
    operations: 'Operaciones',
    work_orders: 'Órdenes de trabajo',
    schedule: 'Cronograma',
    projects: 'Historial de proyectos',
    production: 'Producción',
    manufacturing: 'Manufactura',
    planning: 'Planificación',
    bom: 'Recetas de producción (BOM)',
    dispatch_requests: 'Solicitudes de despacho',
    materials: 'Solicitudes de materiales',
    hr: 'Talento humano',
    employees: 'Nómina de empleados',
    schedules: 'Control de horarios',
    hours: 'Reporte de horas',
};

export interface RbacModuleCategory {
    key: string;
    label: string;
    modules: readonly RbacModule[];
}

export const RBAC_MODULE_CATEGORIES: readonly RbacModuleCategory[] = [
    {
        key: 'core',
        label: 'Panel y Sistema',
        modules: ['dashboard', 'config', 'companies', 'users', 'roles', 'permissions', 'menu', 'audit', 'system'],
    },
    {
        key: 'crm',
        label: 'CRM y Ventas',
        modules: ['crm', 'clients', 'visits', 'budgets', 'invoices'],
    },
    {
        key: 'catalog',
        label: 'Catálogo',
        modules: ['products', 'services', 'categories', 'brands', 'uom', 'attributes'],
    },
    {
        key: 'warehouse',
        label: 'Almacén e Inventario',
        modules: ['inventory', 'movements', 'orders', 'reception_materials', 'locations', 'remission_guides', 'tools', 'tool_loans', 'stock_taking'],
    },
    {
        key: 'purchases',
        label: 'Compras',
        modules: ['suppliers', 'purchase_quotes', 'purchase_orders', 'purchase_invoices', 'retentions'],
    },
    {
        key: 'finance',
        label: 'Finanzas y SRI',
        modules: ['documents', 'receivable', 'payable'],
    },
    {
        key: 'pos',
        label: 'Punto de Venta',
        modules: ['pos', 'pos_sell', 'pos_sessions', 'pos_history'],
    },
    {
        key: 'production',
        label: 'Producción y Operaciones',
        modules: ['operations', 'work_orders', 'schedule', 'projects', 'production', 'manufacturing', 'planning', 'bom', 'dispatch_requests', 'materials'],
    },
    {
        key: 'hr',
        label: 'Talento Humano',
        modules: ['hr', 'employees', 'schedules', 'hours'],
    },
] as const;

export type RoleBadgeTone = 'danger' | 'warning' | 'primary' | 'purple' | 'teal' | 'cyan' | 'indigo' | 'orange' | 'info';

export const ROLE_DISPLAY_META: Record<string, { label: string; variant: RoleBadgeTone; accent: string }> = {
    superadmin: { label: 'Super Administrador', variant: 'danger', accent: 'from-danger/70 via-danger/30' },
    admin: { label: 'Administrador', variant: 'warning', accent: 'from-warning/70 via-warning/30' },
    gerente: { label: 'Gerente', variant: 'purple', accent: 'from-purple-500/70 via-purple-500/30' },
    contador: { label: 'Contador Externo', variant: 'primary', accent: 'from-primary/70 via-primary/30' },
    contabilidad: { label: 'Contabilidad', variant: 'teal', accent: 'from-teal-500/70 via-teal-500/30' },
    rrhh: { label: 'Talento Humano', variant: 'indigo', accent: 'from-indigo-500/70 via-indigo-500/30' },
    ventas: { label: 'Ventas', variant: 'cyan', accent: 'from-cyan-500/70 via-cyan-500/30' },
    inventario: { label: 'Inventario', variant: 'orange', accent: 'from-orange-500/70 via-orange-500/30' },
    produccion: { label: 'Producción', variant: 'info', accent: 'from-info/70 via-info/30' },
};

export function getRbacModuleLabel(module: string): string {
    return RBAC_MODULE_LABELS[module as RbacModule]
        ?? module.replace(/_/g, ' ').replace(/^\w/, c => c.toUpperCase());
}

export function getRbacActionLabel(action: string): string {
    return RBAC_ACTION_LABELS[action as RbacAction]
        ?? action.charAt(0).toUpperCase() + action.slice(1);
}

export function getRbacPermissionDescription(module: string, action: string): string {
    const actionLabel = getRbacActionLabel(action);
    const moduleLabel = getRbacModuleLabel(module).toLowerCase();
    return `${actionLabel} ${moduleLabel}`;
}

export function getRoleDisplayLabel(name: string): string {
    return ROLE_DISPLAY_META[name.toLowerCase()]?.label ?? name;
}
