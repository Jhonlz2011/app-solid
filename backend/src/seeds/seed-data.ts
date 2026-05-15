/**
 * seed-data.ts — Shared RBAC constants (PERMISSIONS, ROLES, ROLE_PERMISSIONS)
 * Used by both seed.ts (dev setup) and tenant-provisioning.service.ts (runtime registration)
 */

interface MenuSeedItem {
    key: string;
    label: string;
    icon: string;
    path?: string;
    permission_prefix?: string;
    sort_order: number;
    children?: MenuSeedItem[];
}

function parsePerm(slug: string, description: string) {
    const [module, action] = slug.split('.');
    return { slug, module, action, description };
}

export const PERMISSIONS = [
    // Dashboard
    parsePerm('dashboard.read', 'Ver panel de control'),
    parsePerm('dashboard.create', 'Crear elementos en dashboard'),
    parsePerm('dashboard.update', 'Editar elementos en dashboard'),
    parsePerm('dashboard.delete', 'Eliminar elementos en dashboard'),

    // CRM
    parsePerm('crm.read', 'Ver módulo CRM'),
    parsePerm('crm.create', 'Crear en CRM'),
    parsePerm('crm.update', 'Editar en CRM'),
    parsePerm('crm.delete', 'Eliminar en CRM'),

    // Clients
    parsePerm('clients.read', 'Ver clientes'),
    parsePerm('clients.create', 'Crear clientes'),
    parsePerm('clients.update', 'Editar clientes'),
    parsePerm('clients.delete', 'Desactivar clientes'),
    parsePerm('clients.restore', 'Restaurar clientes'),
    parsePerm('clients.destroy', 'Eliminar clientes permanentemente'),

    // Technical Visits
    parsePerm('visits.read', 'Ver visitas técnicas'),
    parsePerm('visits.create', 'Crear visitas técnicas'),
    parsePerm('visits.update', 'Editar visitas técnicas'),
    parsePerm('visits.delete', 'Eliminar visitas técnicas'),
    parsePerm('visits.restore', 'Restaurar visitas técnicas'),
    parsePerm('visits.destroy', 'Eliminar visitas técnicas permanentemente'),

    // Budgets/Quotations
    parsePerm('budgets.read', 'Ver presupuestos'),
    parsePerm('budgets.create', 'Crear presupuestos'),
    parsePerm('budgets.update', 'Editar presupuestos'),
    parsePerm('budgets.delete', 'Desactivar presupuestos'),
    parsePerm('budgets.restore', 'Restaurar presupuestos'),
    parsePerm('budgets.destroy', 'Eliminar presupuestos permanentemente'),

    // Invoicing
    parsePerm('invoices.read', 'Ver facturación'),
    parsePerm('invoices.create', 'Crear facturas'),
    parsePerm('invoices.update', 'Editar facturas'),
    parsePerm('invoices.delete', 'Eliminar facturas'),
    parsePerm('invoices.restore', 'Restaurar facturas'),
    parsePerm('invoices.destroy', 'Eliminar facturas permanentemente'),

    // Operations
    parsePerm('operations.read', 'Ver operaciones'),
    parsePerm('operations.create', 'Crear operaciones'),
    parsePerm('operations.update', 'Editar operaciones'),
    parsePerm('operations.delete', 'Eliminar operaciones'),

    // Work Orders
    parsePerm('work_orders.read', 'Ver órdenes de trabajo'),
    parsePerm('work_orders.create', 'Crear órdenes de trabajo'),
    parsePerm('work_orders.update', 'Editar órdenes de trabajo'),
    parsePerm('work_orders.delete', 'Eliminar órdenes de trabajo'),

    // Schedule
    parsePerm('schedule.read', 'Ver cronograma'),
    parsePerm('schedule.create', 'Crear cronograma'),
    parsePerm('schedule.update', 'Editar cronograma'),
    parsePerm('schedule.delete', 'Eliminar cronograma'),

    // Projects
    parsePerm('projects.read', 'Ver historial de proyectos'),
    parsePerm('projects.create', 'Crear proyectos'),
    parsePerm('projects.update', 'Editar proyectos'),
    parsePerm('projects.delete', 'Eliminar proyectos'),

    // Production
    parsePerm('production.read', 'Ver producción'),
    parsePerm('production.create', 'Crear producción'),
    parsePerm('production.update', 'Editar producción'),
    parsePerm('production.delete', 'Eliminar producción'),

    // Planning
    parsePerm('planning.read', 'Ver planificación'),
    parsePerm('planning.create', 'Crear planificación'),
    parsePerm('planning.update', 'Editar planificación'),
    parsePerm('planning.delete', 'Eliminar planificación'),

    // Materials (legacy — Solicitud Herramientas/Material)
    parsePerm('materials.read', 'Ver solicitudes de materiales'),
    parsePerm('materials.create', 'Crear solicitudes de materiales'),
    parsePerm('materials.update', 'Editar solicitudes de materiales'),
    parsePerm('materials.delete', 'Eliminar solicitudes de materiales'),

    // Quality Control
    parsePerm('quality.read', 'Ver control de calidad'),
    parsePerm('quality.create', 'Crear control de calidad'),
    parsePerm('quality.update', 'Editar control de calidad'),
    parsePerm('quality.delete', 'Eliminar control de calidad'),

    // --- CATALOG children ---
    parsePerm('products.read', 'Ver productos'),
    parsePerm('products.create', 'Crear productos'),
    parsePerm('products.update', 'Editar productos'),
    parsePerm('products.delete', 'Eliminar productos'),

    parsePerm('services.read', 'Ver servicios'),
    parsePerm('services.create', 'Crear servicios'),
    parsePerm('services.update', 'Editar servicios'),
    parsePerm('services.delete', 'Eliminar servicios'),

    parsePerm('categories.read', 'Ver categorías'),
    parsePerm('categories.create', 'Crear categorías'),
    parsePerm('categories.update', 'Editar categorías'),
    parsePerm('categories.delete', 'Eliminar categorías'),

    parsePerm('brands.read', 'Ver marcas'),
    parsePerm('brands.create', 'Crear marcas'),
    parsePerm('brands.update', 'Editar marcas'),
    parsePerm('brands.delete', 'Eliminar marcas'),

    // parsePerm('families.read', 'Ver familias de productos'),
    // parsePerm('families.create', 'Crear familias de productos'),
    // parsePerm('families.update', 'Editar familias de productos'),
    // parsePerm('families.delete', 'Eliminar familias de productos'),

    parsePerm('uom.read', 'Ver unidades de medida'),
    parsePerm('uom.create', 'Crear unidades de medida'),
    parsePerm('uom.update', 'Editar unidades de medida'),
    parsePerm('uom.delete', 'Desactivar unidades de medida'),
    parsePerm('uom.restore', 'Restaurar unidades de medida'),
    parsePerm('uom.destroy', 'Eliminar unidades de medida permanentemente'),

    parsePerm('attributes.read', 'Ver atributos de producto'),
    parsePerm('attributes.create', 'Crear atributos de producto'),
    parsePerm('attributes.update', 'Editar atributos de producto'),
    parsePerm('attributes.delete', 'Desactivar atributos de producto'),
    parsePerm('attributes.restore', 'Restaurar atributos de producto'),
    parsePerm('attributes.destroy', 'Eliminar atributos de producto permanentemente'),
    

    // --- WAREHOUSE children ---
    parsePerm('inventory.read', 'Ver inventario'),
    parsePerm('inventory.create', 'Crear en inventario'),
    parsePerm('inventory.update', 'Editar inventario'),
    parsePerm('inventory.delete', 'Desactivar en inventario'),
    parsePerm('inventory.restore', 'Restaurar inventario'),
    parsePerm('inventory.destroy', 'Eliminar inventario permanentemente'),

    parsePerm('movements.read', 'Ver movimientos'),
    parsePerm('movements.create', 'Crear movimientos'),
    parsePerm('movements.update', 'Editar movimientos'),
    parsePerm('movements.delete', 'Desactivar movimientos'),
    parsePerm('movements.restore', 'Restaurar movimientos'),
    parsePerm('movements.destroy', 'Eliminar movimientos permanentemente'),

    parsePerm('orders.read', 'Ver pedidos de material'),
    parsePerm('orders.create', 'Crear pedidos de material'),
    parsePerm('orders.update', 'Editar pedidos de material'),
    parsePerm('orders.delete', 'Eliminar pedidos de material'),
    parsePerm('orders.restore', 'Restaurar pedidos de material'),
    parsePerm('orders.destroy', 'Eliminar pedidos de material permanentemente'),

    parsePerm('locations.read', 'Ver ubicaciones'),
    parsePerm('locations.create', 'Crear ubicaciones'),
    parsePerm('locations.update', 'Editar ubicaciones'),
    parsePerm('locations.delete', 'Desactivar ubicaciones'),
    parsePerm('locations.restore', 'Restaurar ubicaciones'),
    parsePerm('locations.destroy', 'Eliminar ubicaciones permanentemente'),

    parsePerm('reception_materials.read', 'Ver recepción de mercadería'),
    parsePerm('reception_materials.create', 'Crear recepción de mercadería'),
    parsePerm('reception_materials.update', 'Editar recepción de mercadería'),
    parsePerm('reception_materials.delete', 'Eliminar recepción de mercadería'),

    parsePerm('remission_guides.read', 'Ver guías de remisión'),
    parsePerm('remission_guides.create', 'Crear guías de remisión'),
    parsePerm('remission_guides.update', 'Editar guías de remisión'),
    parsePerm('remission_guides.delete', 'Eliminar guías de remisión'),

    // BOM (Recetas)
    parsePerm('bom.read', 'Ver recetas de producción'),
    parsePerm('bom.create', 'Crear recetas de producción'),
    parsePerm('bom.update', 'Editar recetas de producción'),
    parsePerm('bom.delete', 'Eliminar recetas de producción'),

    // Dispatch Requests
    parsePerm('dispatch_requests.read', 'Ver solicitudes de despacho'),
    parsePerm('dispatch_requests.create', 'Crear solicitudes de despacho'),
    parsePerm('dispatch_requests.update', 'Editar solicitudes de despacho'),
    parsePerm('dispatch_requests.delete', 'Eliminar solicitudes de despacho'),

    // --- PURCHASES children ---
    parsePerm('suppliers.read', 'Ver proveedores'),
    parsePerm('suppliers.create', 'Crear proveedores'),
    parsePerm('suppliers.update', 'Editar proveedores'),
    parsePerm('suppliers.delete', 'Eliminar proveedores'),
    parsePerm('suppliers.restore', 'Restaurar proveedores'),
    parsePerm('suppliers.destroy', 'Eliminar proveedores permanentemente'),

    parsePerm('purchase_quotes.read', 'Ver cotizaciones de compra'),
    parsePerm('purchase_quotes.create', 'Crear cotizaciones de compra'),
    parsePerm('purchase_quotes.update', 'Editar cotizaciones de compra'),
    parsePerm('purchase_quotes.delete', 'Eliminar cotizaciones de compra'),
    parsePerm('purchase_quotes.restore', 'Restaurar cotizaciones de compra'),
    parsePerm('purchase_quotes.destroy', 'Eliminar cotizaciones de compra permanentemente'),

    parsePerm('purchase_orders.read', 'Ver órdenes de compra'),
    parsePerm('purchase_orders.create', 'Crear órdenes de compra'),
    parsePerm('purchase_orders.update', 'Editar órdenes de compra'),
    parsePerm('purchase_orders.delete', 'Eliminar órdenes de compra'),
    parsePerm('purchase_orders.restore', 'Restaurar órdenes de compra'),
    parsePerm('purchase_orders.destroy', 'Eliminar órdenes de compra permanentemente'),

    parsePerm('purchase_invoices.read', 'Ver facturas de compra'),
    parsePerm('purchase_invoices.create', 'Crear facturas de compra'),
    parsePerm('purchase_invoices.update', 'Editar facturas de compra'),
    parsePerm('purchase_invoices.delete', 'Eliminar facturas de compra'),
    parsePerm('purchase_invoices.restore', 'Restaurar facturas de compra'),
    parsePerm('purchase_invoices.destroy', 'Eliminar facturas de compra permanentemente'),

    // --- FINANCE children ---
    parsePerm('documents.read', 'Ver documentos electrónicos'),
    parsePerm('documents.create', 'Crear documentos electrónicos'),
    parsePerm('documents.update', 'Editar documentos electrónicos'),
    parsePerm('documents.delete', 'Eliminar documentos electrónicos'),
    parsePerm('documents.restore', 'Restaurar documentos electrónicos'),
    parsePerm('documents.destroy', 'Eliminar documentos electrónicos permanentemente'),

    parsePerm('retentions.read', 'Ver retenciones'),
    parsePerm('retentions.create', 'Crear retenciones'),
    parsePerm('retentions.update', 'Editar retenciones'),
    parsePerm('retentions.delete', 'Eliminar retenciones'),
    parsePerm('retentions.restore', 'Restaurar retenciones'),
    parsePerm('retentions.destroy', 'Eliminar retenciones permanentemente'),

    parsePerm('receivable.read', 'Ver cuentas por cobrar'),
    parsePerm('receivable.create', 'Crear cuentas por cobrar'),
    parsePerm('receivable.update', 'Editar cuentas por cobrar'),
    parsePerm('receivable.delete', 'Eliminar cuentas por cobrar'),
    parsePerm('receivable.restore', 'Restaurar cuentas por cobrar'),
    parsePerm('receivable.destroy', 'Eliminar cuentas por cobrar permanentemente'),

    parsePerm('payable.read', 'Ver cuentas por pagar'),
    parsePerm('payable.create', 'Crear cuentas por pagar'),
    parsePerm('payable.update', 'Editar cuentas por pagar'),
    parsePerm('payable.delete', 'Eliminar cuentas por pagar'),
    parsePerm('payable.restore', 'Restaurar cuentas por pagar'),
    parsePerm('payable.destroy', 'Eliminar cuentas por pagar permanentemente'),

    // --- POS children ---
    parsePerm('pos_sell.read', 'Ver caja POS'),
    parsePerm('pos_sell.create', 'Operar caja POS'),
    parsePerm('pos_sell.update', 'Editar caja POS'),
    parsePerm('pos_sell.delete', 'Eliminar en caja POS'),

    parsePerm('pos_sessions.read', 'Ver sesiones POS'),
    parsePerm('pos_sessions.create', 'Crear sesiones POS'),
    parsePerm('pos_sessions.update', 'Editar sesiones POS'),
    parsePerm('pos_sessions.delete', 'Eliminar sesiones POS'),

    parsePerm('pos_history.read', 'Ver historial de ventas POS'),
    parsePerm('pos_history.create', 'Crear en historial POS'),
    parsePerm('pos_history.update', 'Editar historial POS'),
    parsePerm('pos_history.delete', 'Eliminar historial POS'),

    // --- HR children ---
    parsePerm('hr.read', 'Ver talento humano'),
    parsePerm('hr.create', 'Crear en talento humano'),
    parsePerm('hr.update', 'Editar en talento humano'),
    parsePerm('hr.delete', 'Eliminar en talento humano'),

    parsePerm('payroll.read', 'Ver nómina'),
    parsePerm('payroll.create', 'Crear nómina'),
    parsePerm('payroll.update', 'Editar nómina'),
    parsePerm('payroll.delete', 'Eliminar nómina'),

    parsePerm('schedules.read', 'Ver horarios'),
    parsePerm('schedules.create', 'Crear horarios'),
    parsePerm('schedules.update', 'Editar horarios'),
    parsePerm('schedules.delete', 'Eliminar horarios'),

    parsePerm('hours.read', 'Ver reporte de horas'),
    parsePerm('hours.create', 'Crear reporte de horas'),
    parsePerm('hours.update', 'Editar reporte de horas'),
    parsePerm('hours.delete', 'Eliminar reporte de horas'),

    // --- SYSTEM children ---
    parsePerm('system.read', 'Ver sistema'),
    parsePerm('system.create', 'Crear en sistema'),
    parsePerm('system.update', 'Editar sistema'),
    parsePerm('system.delete', 'Eliminar en sistema'),

    parsePerm('config.read', 'Ver configuración'),
    parsePerm('config.create', 'Crear configuración'),
    parsePerm('config.update', 'Editar configuración'),
    parsePerm('config.delete', 'Eliminar configuración'),

    parsePerm('users.read', 'Ver usuarios'),
    parsePerm('users.create', 'Crear usuarios'),
    parsePerm('users.update', 'Editar usuarios'),
    parsePerm('users.delete', 'Eliminar usuarios'),
    parsePerm('users.restore', 'Restaurar usuarios'),
    parsePerm('users.destroy', 'Eliminar usuarios permanentemente'),

    parsePerm('audit.read', 'Ver auditoría'),
    parsePerm('audit.create', 'Crear auditoría'),
    parsePerm('audit.update', 'Editar auditoría'),
    parsePerm('audit.delete', 'Eliminar auditoría'),
    parsePerm('audit.restore', 'Restaurar auditoría'),
    parsePerm('audit.destroy', 'Eliminar auditoría permanentemente'),

    parsePerm('roles.read', 'Ver roles'),
    parsePerm('roles.create', 'Crear roles'),
    parsePerm('roles.update', 'Editar roles'),
    parsePerm('roles.delete', 'Eliminar roles'),
    parsePerm('roles.restore', 'Restaurar roles'),
    parsePerm('roles.destroy', 'Eliminar roles permanentemente'),

    parsePerm('permissions.read', 'Ver permisos'),
    parsePerm('permissions.create', 'Asignar permisos'),
    parsePerm('permissions.update', 'Modificar asignación de permisos'),
    parsePerm('permissions.delete', 'Revocar permisos'),
];

export const ROLES = [
    { name: 'superadmin', description: 'Super Administrador con acceso total al sistema', is_system: true },
    { name: 'admin', description: 'Administrador del sistema' },
    { name: 'gerente', description: 'Gerente con acceso a reportes y aprobaciones' },
    { name: 'ventas', description: 'Equipo de ventas y CRM' },
    { name: 'produccion', description: 'Equipo de producción y manufactura' },
    { name: 'inventario', description: 'Gestión de inventario y almacén' },
    { name: 'contabilidad', description: 'Equipo de finanzas y contabilidad' },
    { name: 'rrhh', description: 'Recursos Humanos' },
];

export const ROLE_PERMISSIONS: Record<string, (slug: string) => boolean> = {
    superadmin: () => true,

    admin: (slug) => {
        const blocked = ['system.delete', 'config.delete', 'users.delete', 'roles.delete', 'permissions.delete'];
        return !blocked.includes(slug) && !slug.endsWith('.delete');
    },

    gerente: (slug) => {
        return slug.startsWith('dashboard.') ||
            slug === 'crm.read' ||
            slug.startsWith('clients.') ||
            slug === 'invoices.read' ||
            slug === 'hr.read' ||
            slug === 'audit.read';
    },

    ventas: (slug) => {
        return slug === 'dashboard.read' ||
            slug.startsWith('crm.') ||
            slug.startsWith('clients.') ||
            slug.startsWith('visits.') ||
            slug.startsWith('budgets.') ||
            slug.startsWith('invoices.');
    },

    produccion: (slug) => {
        return slug === 'dashboard.read' ||
            slug.startsWith('planning.') ||
            slug.startsWith('bom.') ||
            slug.startsWith('dispatch_requests.') ||
            slug.startsWith('work_orders.') ||
            slug.startsWith('materials.') ||
            slug.startsWith('quality.');
    },

    inventario: (slug) => {
        return slug === 'dashboard.read' ||
            slug.startsWith('inventory.') ||
            slug.startsWith('products.') ||
            slug.startsWith('services.') ||
            slug.startsWith('categories.') ||
            slug.startsWith('brands.') ||
            slug.startsWith('families.') ||
            slug.startsWith('uom.') ||
            slug.startsWith('attributes.') ||
            slug.startsWith('movements.') ||
            slug.startsWith('orders.') ||
            slug.startsWith('locations.') ||
            slug.startsWith('reception_materials.') ||
            slug.startsWith('remission_guides.');
    },

    contabilidad: (slug) => {
        return slug === 'dashboard.read' ||
            slug.startsWith('invoices.') ||
            slug.startsWith('documents.') ||
            slug.startsWith('retentions.') ||
            slug.startsWith('receivable.') ||
            slug.startsWith('payable.') ||
            slug.startsWith('suppliers.') ||
            slug.startsWith('purchase_orders.') ||
            slug.startsWith('purchase_invoices.');
    },

    rrhh: (slug) => {
        return slug === 'dashboard.read' ||
            slug.startsWith('hr.') ||
            slug.startsWith('payroll.') ||
            slug.startsWith('schedules.') ||
            slug.startsWith('hours.');
    },
};

export const UOM_DATA = [
    { code: 'UND', name: 'Unidad', uom_group: 'CANTIDAD' as const, base_factor: '1', is_system: true },
    { code: 'M', name: 'Metro', uom_group: 'LONGITUD' as const, base_factor: '1', is_system: true },
    { code: 'M2', name: 'Metro Cuadrado', uom_group: 'AREA' as const, base_factor: '1', is_system: true },
    { code: 'L', name: 'Litro', uom_group: 'VOLUMEN' as const, base_factor: '1', is_system: true },
    { code: 'KG', name: 'Kilogramo', uom_group: 'PESO' as const, base_factor: '1', is_system: true },
    { code: 'S', name: 'Segundo', uom_group: 'TIEMPO' as const, base_factor: '1', is_system: true },
    { code: 'B', name: 'Byte', uom_group: 'DATA' as const, base_factor: '1', is_system: true },
];

export const DERIVED_UOM_DATA = [
    { code: 'PAR', name: 'Par', uom_group: 'CANTIDAD' as const, base_factor: '2' },
    { code: 'DOC', name: 'Docena', uom_group: 'CANTIDAD' as const, base_factor: '12' },
    { code: 'MIL', name: 'Millar', uom_group: 'CANTIDAD' as const, base_factor: '1000' },
    { code: 'KM', name: 'Kilómetro', uom_group: 'LONGITUD' as const, base_factor: '1000' },
    { code: 'CM', name: 'Centímetro', uom_group: 'LONGITUD' as const, base_factor: '0.01' },
    { code: 'MM', name: 'Milímetro', uom_group: 'LONGITUD' as const, base_factor: '0.001' },
    { code: 'IN', name: 'Pulgada', uom_group: 'LONGITUD' as const, base_factor: '0.0254' },
    { code: 'FT', name: 'Pie', uom_group: 'LONGITUD' as const, base_factor: '0.3048' },
    { code: 'ML', name: 'Mililitro', uom_group: 'VOLUMEN' as const, base_factor: '0.001' },
    { code: 'GAL', name: 'Galón', uom_group: 'VOLUMEN' as const, base_factor: '3.78541178' },
    { code: 'G', name: 'Gramo', uom_group: 'PESO' as const, base_factor: '0.001' },
    { code: 'LB', name: 'Libra', uom_group: 'PESO' as const, base_factor: '0.45359237' },
];


export const MENU_ITEMS: MenuSeedItem[] = [
    {
        key: 'dashboard',
        label: 'Panel de Control',
        icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6',
        path: '/dashboard',
        permission_prefix: 'dashboard',
        sort_order: 0,
    },
    {
        key: 'crm',
        label: 'CRM y Ventas',
        icon: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z',
        permission_prefix: 'crm',
        sort_order: 10,
        children: [
            { key: 'clients', label: 'Clientes', path: '/clients', permission_prefix: 'clients', sort_order: 0, icon: 'M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z' },
            { key: 'technical_visits', label: 'Visitas Técnicas', path: '/visits', permission_prefix: 'visits', sort_order: 1, icon: 'M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7' },
            { key: 'budgets', label: 'Presupuestos', path: '/budgets', permission_prefix: 'budgets', sort_order: 2, icon: 'M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z' },
            { key: 'invoicing', label: 'Facturación', path: '/invoices', permission_prefix: 'invoices', sort_order: 3, icon: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z' },
        ],
    },
    {
        key: 'catalog',
        label: 'Catalogo',
        icon: 'M5 3a2 2 0 0 0-2 2v12a4 4 0 0 0 1.2 3q1.3 1 2.8 1h12q1.8-.2 2-2v-4q-.2-1.8-2-2h-2.2l1.9-2c1-.9 1-2.5 0-3.4l-2-2a2.4 2.4 0 0 0-3.4 0L11 8V5c0-1.1-1-2-2.1-2zm0 0h4c1 0 2 1 2 2v12a4 4 0 0 1-.8 2.4l-.3.4-.2.2A4 4 0 0 1 7 21q-1.6 0-2.7-1A4 4 0 0 1 3 17V5C3 4 3.9 3 5 3m10 2q1 0 1.7.7l1.9 2c1 .9 1 2.4 0 3.3l-8 8q.5-.8.5-2V8l2.2-2.3Q14.1 5 15 5m1.7 8H19c1 0 2 1 2 2v4c0 1-1 2-2 2H8a4 4 0 0 0 2.3-1.5zM7 17l-.1.1.1.1.1-.1z',
        permission_prefix: 'catalog',
        sort_order: 20,
        children: [
            { key: 'products', label: 'Productos', path: '/products', permission_prefix: 'products', sort_order: 0, icon: 'M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4' },
            { key: 'services', label: 'Servicios', path: '/services', permission_prefix: 'services', sort_order: 1, icon: 'M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.1-3.1q.7-.4 1 .2a6 6 0 0 1-8.3 7l-7.9 8a1 1 0 0 1-3-3l8-8a6 6 0 0 1 7-8.2c.4.1.5.7.2 1z' },
            { key: 'categories', label: 'Categorias', path: '/categories', permission_prefix: 'categories', sort_order: 2, icon: 'M 7 1.75 C 6.3126052 1.75 5.75 2.3126052 5.75 3 L 5.75 9.171875 C 5.7501274 9.7684673 5.9882382 10.341881 6.4101562 10.763672 L 13.119141 17.472656 C 14.15362 18.515654 15.84638 18.515654 16.880859 17.472656 L 21.472656 12.880859 C 22.515654 11.84638 22.515654 10.15362 21.472656 9.1191406 L 14.763672 2.4101562 C 14.341881 1.988238 13.768467 1.7501274 13.171875 1.75 L 7 1.75 z M 7 2.25 L 13.171875 2.25 C 13.636062 2.2500991 14.081976 2.4353926 14.410156 2.7636719 L 21.119141 9.4726562 C 21.969253 10.315826 21.969253 11.684174 21.119141 12.527344 L 16.527344 17.119141 C 15.684174 17.969253 14.315826 17.969253 13.472656 17.119141 L 6.7636719 10.410156 C 6.4353926 10.081976 6.2500991 9.6360619 6.25 9.171875 L 6.25 3 C 6.25 2.5828253 6.5828253 2.25 7 2.25 z M 10.5 5.75 C 10.088748 5.75 9.75 6.0887476 9.75 6.5 C 9.75 6.9112524 10.088748 7.25 10.5 7.25 C 10.911252 7.25 11.25 6.9112524 11.25 6.5 C 11.25 6.0887476 10.911252 5.75 10.5 5.75 z M 2 6.75 A 0.25 0.25 0 0 0 1.75 7 L 1.75 13.171875 C 1.7501274 13.768467 1.9882381 14.341881 2.4101562 14.763672 L 9.1191406 21.472656 C 10.06707 22.427919 11.586427 22.519597 12.642578 21.685547 A 0.25 0.25 0 0 0 12.683594 21.333984 A 0.25 0.25 0 0 0 12.332031 21.292969 C 11.472237 21.971954 10.244348 21.896803 9.4726562 21.119141 L 2.7636719 14.410156 C 2.4353926 14.081976 2.2500991 13.636062 2.25 13.171875 L 2.25 7 A 0.25 0.25 0 0 0 2 6.75 z ' },
            { key: 'brands', label: 'Marcas', path: '/brands', permission_prefix: 'brands', sort_order: 3, icon: 'M7 3a2 2 0 0 0-2 2v15a1 1 0 0 0 1.5.9l4.5-2.6a2 2 0 0 1 2 0l4.5 2.6A1 1 0 0 0 19 20V5a2 2 0 0 0-2-2zm0 0h10a2 2 0 0 1 2 2v15a1 1 0 0 1-1.5.9L13 18.3a2 2 0 0 0-2 0l-4.5 2.6A1 1 0 0 1 5 20V5q.2-1.8 2-2' },
            { key: 'families', label: 'Familias', path: '/families', permission_prefix: 'families', sort_order: 4, icon: 'm12 2-.9.1-8.5 4A1 1 0 0 0 2 7q0 .7.6 1l8.6 3.9a2 2 0 0 0 1.7 0l8.5-4q.7-.2.7-.9a1 1 0 0 0-.7-1L13 2.1zm0 0 .8.2 8.6 4q.6.2.6.8t-.6.9l-8.6 3.9a2 2 0 0 1-1.6 0l-8.6-4a1 1 0 0 1-.5-.8q0-.6.5-.9l8.6-3.9zM2 12q0 .7.6 1l8.6 3.9a2 2 0 0 0 1.7 0l8.5-4q.6-.2.7-.9H22q0 .6-.6.9l-8.6 3.9a2 2 0 0 1-1.6 0l-8.6-4a1 1 0 0 1-.5-.8zm0 5q0 .6.6 1l8.6 3.9a2 2 0 0 0 1.7 0l8.5-4q.6-.2.7-.9H22q0 .6-.6.9l-8.6 3.9a2 2 0 0 1-1.6 0l-8.6-4a1 1 0 0 1-.5-.8z' },
            { key: 'uom', label: 'Unidades de medidas', path: '/uom', permission_prefix: 'uom', sort_order: 5, icon: 'M21.3 15.3a2.4 2.4 0 0 1 0 3.4l-2.6 2.6a2.4 2.4 0 0 1-3.4 0L2.7 8.7a2.4 2.4 0 0 1 0-3.4l2.6-2.6a2.4 2.4 0 0 1 3.4 0ZM14.5 12.5l2-2M11.5 9.5l2-2M8.5 6.5l2-2M17.5 15.5l2-2' },
            { key: 'attributes', label: 'Atributos', path: '/attributes', permission_prefix: 'attributes', sort_order: 6, icon: 'M4 3a1 1 0 0 0-1 1v7q0 1 1 1h5q1 0 1-1V4q0-1-1-1zm11 0a1 1 0 0 0-1 1v3q0 1 1 1h5q1 0 1-1V4q0-1-1-1zm0 9a1 1 0 0 0-1 1v7q0 1 1 1h5q1 0 1-1v-7q0-1-1-1zM4 16a1 1 0 0 0-1 1v3q0 1 1 1h5q1 0 1-1v-3q0-1-1-1z' }
        ],
    },
    {
        key: 'warehouse',
        label: 'Almacen',
        icon: 'M 12.000977 1.9379883 C 11.676223 1.9380674 11.351527 2.01488 11.054688 2.1679688 L 11.052734 2.1679688 L 3.1035156 6.140625 C 2.3903631 6.4848164 1.9370351 7.2080438 1.9375 8 L 1.9375 19 C 1.9375 20.138347 2.861653 21.0625 4 21.0625 L 6 21.0625 L 18 21.0625 L 20 21.0625 C 21.138347 21.0625 22.0625 20.138347 22.0625 19 L 22.0625 8 C 22.062775 7.2073051 21.608871 6.4842582 20.894531 6.140625 L 12.947266 2.1679688 C 12.650541 2.0145637 12.32573 1.9379092 12.000977 1.9379883 z M 12.000977 2.0629883 C 12.306259 2.0629883 12.611542 2.1350123 12.890625 2.2792969 L 20.839844 6.2519531 A 0.06250625 0.06250625 0 0 0 20.839844 6.2539062 C 21.511092 6.5768354 21.937758 7.2550728 21.9375 8 L 21.9375 19 C 21.9375 20.070792 21.070792 20.9375 20 20.9375 L 18.0625 20.9375 L 18.0625 17 L 18.0625 13 L 18.0625 10 C 18.0625 9.4139377 17.586062 8.9375 17 8.9375 L 7 8.9375 C 6.4139377 8.9375 5.9375 9.4139377 5.9375 10 L 5.9375 13 L 5.9375 17 L 5.9375 20.9375 L 4 20.9375 C 2.929208 20.9375 2.0625 20.070792 2.0625 19 L 2.0625 8 C 2.0620628 7.2552928 2.4872867 6.5771091 3.1582031 6.2539062 A 0.06250625 0.06250625 0 0 0 3.1601562 6.2519531 L 11.109375 2.2792969 A 0.06250625 0.06250625 0 0 0 11.111328 2.2792969 C 11.390412 2.1350123 11.695694 2.0629883 12.000977 2.0629883 z M 7 9.0625 L 17 9.0625 C 17.518507 9.0625 17.9375 9.4814928 17.9375 10 L 17.9375 12.9375 L 6.0625 12.9375 L 6.0625 10 C 6.0625 9.4814928 6.4814928 9.0625 7 9.0625 z M 6.0625 13.0625 L 17.9375 13.0625 L 17.9375 16.9375 L 6.0625 16.9375 L 6.0625 13.0625 z M 6.0625 17.0625 L 17.9375 17.0625 L 17.9375 20.9375 L 6.0625 20.9375 L 6.0625 17.0625 z',
        permission_prefix: 'warehouse',
        sort_order: 30,
        children: [
            { key: 'inventory', label: 'Inventario', path: '/inventory', permission_prefix: 'inventory', sort_order: 0, icon: 'M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4' },
            { key: 'movements', label: 'Movimientos', path: '/movements', permission_prefix: 'movements', sort_order: 1, icon: 'M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4' },
            { key: 'material_orders', label: 'Pedido de Material', path: '/orders', permission_prefix: 'orders', sort_order: 2, icon: 'M6 2a2 2 0 0 0-2 2v3.8V4c0-1 1-2 2-2h8v5q0 1 1 1h5v12c0 1-1 2-2 2h-3.5H18q1.8-.2 2-2V8q0-1-.7-1.7l-3.6-3.6q-.6-.7-1.7-.8zm8 0q1 0 1.7.7l3.6 3.6q.6.7.6 1.6H15a1 1 0 0 1-1-.9zM6.5 8.4h5.4zM7 11l-1 .2-3 1.9q-1 .5-1 1.8V18a2 2 0 0 0 1 1.8l3 1.8q.4.3 1 .3t1-.2l3-1.9q1-.5 1-1.8V15a2 2 0 0 0-1-1.8l-3-1.8zm0 0 1 .3 3 1.9q1 .6 1 1.7v3.2a2 2 0 0 1-1 1.8l-3 1.8-1 .2V17l4.7-2.8L7 16.9l-4.7-2.7L6.9 17v5l-.9-.3-3-1.9a2 2 0 0 1-1-1.7v-3.2A2 2 0 0 1 3 13l3-1.8zm6.1 1.5v.1h5.2v-.1zm.4 4.6v.1h4.8z' },
            { key: 'reception_materials', label: 'Recepcion de Mercaderia', path: '/reception-materials', permission_prefix: 'reception_materials', sort_order: 3, icon: 'M3 3a1 1 0 0 0-1 1v3q0 1 1 1h1v11q.2 1.8 2 2h2-2c-1 0-2-1-2-2V8h16v11c0 1-1 2-2 2h-2 2q1.8-.2 2-2V8h1q1 0 1-1V4q0-1-1-1zm0 0h18q.9.1 1 1v3q-.1.9-1 1H3a1 1 0 0 1-1-1V4q.1-.9 1-1m9 9-3 3 3-2.9V21v-8.9l3 3V15z' },
            { key: 'locations', label: 'Ubicaciones', path: '/locations', permission_prefix: 'locations', sort_order: 4, icon: 'M4 2v20-2h16v2V2v2H4zm0 2h16v8h-8V9q0-1-1-1H9a1 1 0 0 0-1 1v3H4zm5 4h2q.9.1 1 1v3H8V9q.1-.9 1-1m-5 4h16v8h-4v-3q0-1-1-1h-2a1 1 0 0 0-1 1v3H4zm9 4h2q.9.1 1 1v3h-4v-3q.1-.9 1-1' },
            { key: 'shipping_guides', label: 'Guías de Remisión', path: '/shipping-guides', permission_prefix: 'remission_guides', sort_order: 5, icon: 'M9 2a1 1 0 0 0-1 1v1H6a2 2 0 0 0-2 2v14q.2 1.8 2 2h12a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2h-2V3q0-1-1-1zm0 0h6q1 0 1 1v2q0 1-1 1H9a1 1 0 0 1-1-1V3q0-1 1-1M6 4h2v1q0 1 1 1h6q1 0 1-1V4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6q.2-1.8 2-2M8 11zl.1.1.1-.1zm4 0h4zm-4 5zl.1.1.1-.1zm4 0h4z' },
        ],
    },
    {
        key: 'operations',
        label: 'Operaciones',
        icon: 'M19 1.9q-1 0-1.8.9L15 5l-2 2-3-3-1.3-1.3a2.4 2.4 0 0 0-3.4 0L2.7 5.3c-1 1-1 2.5 0 3.4L6.9 13l-3 3.1-.6.9L2 21.3q-.2.9.7.7L7 20.7q.4-.1.9-.5l3-3.1 4.4 4.2c1 1 2.5 1 3.4 0l2.6-2.6c1-1 1-2.5 0-3.4L17.1 11l2-2 2.1-2.2q1-1 .9-2.1a3 3 0 0 0-.9-2A3 3 0 0 0 19 2m0 .1h.3q1 0 1.8.9t.9 1.8-.9 2L19 9 15 5 17.3 3Q18.1 2 19 2M7 2q1 0 1.7.7L9.9 4 8 6H8l2-2 3 3-6 6-4.3-4.3c-.9-1-.9-2.4 0-3.4l2.6-2.6Q6.1 2.1 7 2m8 3 4 4L7.7 20l-.8.5L2.6 22a.4.4 0 0 1-.5-.5L3.4 17q.1-.5.5-.8zm2 6 3 3-2 2 2-2 1.3 1.3q1.4 1.7 0 3.4l-2.6 2.6q-1.7 1.4-3.4 0L11.1 17z',
        permission_prefix: 'operations',
        sort_order: 40,
        children: [
            { key: 'work_orders', label: 'Orden de Trabajo', path: '/work-orders', permission_prefix: 'work_orders', sort_order: 0, icon: 'M4 5a2 2 0 0 0-2 2v2q1.5 0 2.2 1 .7.8.7 2a3 3 0 0 1-.7 2q-.7 1-2.2 1v2q.2 1.8 2 2h16q1.8-.2 2-2v-2q-1.5 0-2.2-1a3 3 0 0 1-.7-2q0-1.1.7-2 .7-1 2.2-1V7q-.2-1.8-2-2H4m0 0h9v2-2h7c1 0 2 1 2 2v2a3 3 0 0 0-2.3.9q-.8.9-.8 2.1t.8 2.1a3 3 0 0 0 2.2 1V17c0 1-.8 2-1.9 2h-7v-2 2H4c-1 0-2-1-2-2v-2a3 3 0 0 0 2.3-.9q.8-.9.8-2.1t-.8-2.1a3 3 0 0 0-2.2-1V7C2 6 2.9 5 4 5m9 6v2z' },
            { key: 'schedule', label: 'Cronograma', path: '/order-schedule', permission_prefix: 'schedule', sort_order: 1, icon: 'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z' },
            { key: 'project_history', label: 'Historial de Proyectos', path: '/history', permission_prefix: 'projects', sort_order: 2, icon: 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z' },
        ],
    },
    {
        key: 'production',
        label: 'Producción',
        icon: 'M19.428 15.428a2 2 0 00-1.022-.547l-2.384-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z',
        permission_prefix: 'production',
        sort_order: 50,
        children: [
            { key: 'planning', label: 'Planificación', path: '/planning', permission_prefix: 'planning', sort_order: 0, icon: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z' },
            { key: 'bom', label: 'Recetas', path: '/bom', permission_prefix: 'bom', sort_order: 1, icon: 'M8 2v2H6a2 2 0 0 0-2 2v14q.2 1.8 2 2h12q1.8-.2 2-2V6q-.2-1.8-2-2h-2V2v2h-4V2v2H8zM6 4h2v2-2h4v2-2h4v2-2h2c1 0 2 1 2 2v14c0 1-1 2-2 2H6c-1 0-2-1-2-2V6c0-1 1-2 2-2m2 6h6zm0 4h8zm0 4h5z' },
            { key: 'dispatch_requests', label: 'Solicitud de Despacho', path: '/dispatch-requests', permission_prefix: 'dispatch_requests', sort_order: 2, icon: 'M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z' },
        ],
    },
    {
        key: 'purchases',
        label: 'Compras',
        icon: 'M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z',
        permission_prefix: 'purchases',
        sort_order: 60,
        children: [
            { key: 'suppliers', label: 'Proveedores', path: '/suppliers', permission_prefix: 'suppliers', sort_order: 0, icon: 'M20 6.9a2 2 0 0 0-1.4.6L14.8 11a2 2 0 0 0-.3-2.4 2 2 0 0 0-1.5-.7h-3q-1 0-1.4.7L3 13.9l-1-1v.1l1 1 4 4 1 1-1-1 1.6-1.4q.5-.5 1.4-.5h4q1.7 0 2.8-1.3l4.6-4.4q.7-.7.7-1.5t-.6-1.4A2 2 0 0 0 20 7m0 0h.2q.8.1 1.2.7.6.6.6 1.3t-.6 1.5l-4.6 4.4Q15.7 16 14 15.9h-4q-1 0-1.4.7L7 17.9 3 14l5.6-5.4q.5-.5 1.4-.5h3q1 0 1.5.6t.4 1.3-.3 1.2l-.2.2q-.5.5-1.4.5h-2v.1h2a2 2 0 0 0 1.6-.7l4-3.8A2 2 0 0 1 20 7' },
            { key: 'purchase_quotes', label: 'Cotización de Compra', path: '/purchase-quotes', permission_prefix: 'purchase_quotes', sort_order: 1, icon: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z' },
            { key: 'purchase_orders', label: 'Órdenes de Compra', path: '/purchase-orders', permission_prefix: 'purchase_orders', sort_order: 2, icon: 'M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z' },
            { key: 'invoice_reception', label: 'Recepción de Facturas', path: '/purchase-invoices', permission_prefix: 'purchase_invoices', sort_order: 3, icon: 'm10 2-.7.2-.8.6a1 1 0 0 1-1.2 0l-.8-.6-.6-.2q-.9 0-1 1v18q.1 1 1 1 .3 0 .6-.2l.8-.6a1 1 0 0 1 1.2 0l.8.6q.7.5 1.3 0l.8-.6a1 1 0 0 1 1.2 0l.8.6q.7.5 1.3 0l.8-.6a1 1 0 0 1 1.2 0l.8.6q.3.2.7.2.8 0 .9-1V3q0-1-1-1l-.6.2-.8.6a1 1 0 0 1-1.2 0l-.8-.6a1 1 0 0 0-1.3 0l-.8.6a1 1 0 0 1-1.2 0l-.8-.6zm0 0q.3 0 .6.2l.8.6q.7.4 1.2 0l.9-.6a1 1 0 0 1 1.2 0l.8.6q.7.4 1.2 0l.9-.6.6-.2q.7.1.8 1v18q-.1.9-.8 1l-.6-.2-.9-.6a1 1 0 0 0-1.2 0l-.8.6a1 1 0 0 1-1.2 0l-.9-.6a1 1 0 0 0-1.2 0l-.8.6a1 1 0 0 1-1.2 0l-.9-.6a1 1 0 0 0-1.2 0l-.8.6-.6.2q-.8-.1-.9-1V3q0-.9.9-1 .3 0 .6.2l.8.6q.7.4 1.2 0l.9-.6zm3.3 5v.9h-2.7V7v.9h-.4q-.8 0-1.2.6-.5.7-.5 1.4 0 .8.5 1.4t1.2.7h.4v4h-2 2v1-1h2.6v1-1h.3q.9 0 1.3-.6t.4-1.4-.4-1.4-1.3-.7h-.2V8h1.9-2zm-3 1h.3v4h-.4q-.8 0-1.2-.7T8.6 10 9 8.6t1.2-.6m.3 0h2.6v4h-2.6zm0 4h2.6v4h-2.6zm2.7 0h.2q.9 0 1.3.6.3.6.4 1.4 0 .8-.4 1.3t-1.3.6h-.2z' },
            { key: 'retentions', label: 'Retenciones', path: '/retentions', permission_prefix: 'retentions', sort_order: 4, icon: 'M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z' },
        ],
    },
    {
        key: 'pos', label: 'Punto de Venta', icon: 'M7 2a2 2 0 0 0-1.7.8L2.4 7c-.9 1.3-.5 2.7.4 3.4q.5.5 1.1.6v8c0 1.1 1 2 2.1 2h12q1.8-.2 2-2v-8q.7 0 1.2-.6c.9-.7 1.3-2.1.4-3.4l-3-4.2A2 2 0 0 0 17 2zm0 0h10a2 2 0 0 1 1.6.9l3 4.2q1 2-.5 3.3l-1 .5H20q-1.1.3-2.2-.6-.8-.7-1.6 0c-1 .9-2.4.9-3.4 0q-.8-.7-1.6 0c-1 .9-2.4.9-3.4 0-.4-.5-1.2-.5-1.6 0q-1.1.9-2.2.6-.6-.1-1.1-.5c-.9-.8-1.3-2-.4-3.3l2.9-4.2A2 2 0 0 1 7 2.1m0 8q.4 0 .7.3c1 1 2.6 1 3.6 0a1 1 0 0 1 1.4 0c1 1 2.6 1 3.6 0a1 1 0 0 1 1.4 0q1.1 1 2.2.7v8c0 1-.8 2-1.9 2h-3v-5q0-1-1-1h-4a1 1 0 0 0-1 1v5H6c-1 0-2-1-2-2v-8q1.2.3 2.3-.7.3-.3.7-.3m3 5h4q.9.1 1 1v5H9v-5q.1-.9 1-1', sort_order: 70, permission_prefix: 'pos', children: [
            { key: 'pos_sell', label: 'Caja', path: '/pos', permission_prefix: 'pos_sell', sort_order: 0, icon: 'M21 18L20.1703 11.7771C20.0391 10.7932 19.9735 10.3012 19.7392 9.93082C19.5327 9.60444 19.2362 9.34481 18.8854 9.1833C18.4873 9 17.991 9 16.9983 9H7.00165C6.00904 9 5.51274 9 5.11461 9.1833C4.76381 9.34481 4.46727 9.60444 4.26081 9.93082C4.0265 10.3012 3.96091 10.7932 3.82972 11.7771L3 18M21 18H3M21 18V19.4C21 19.9601 21 20.2401 20.891 20.454C20.7951 20.6422 20.6422 20.7951 20.454 20.891C20.2401 21 19.9601 21 19.4 21H4.6C4.03995 21 3.75992 21 3.54601 20.891C3.35785 20.7951 3.20487 20.6422 3.10899 20.454C3 20.2401 3 19.9601 3 19.4V18M7.5 12V12.01M10.5 12V12.01M9 15V15.01M12 15V15.01M15 15V15.01M13.5 12V12.01M16.5 12V12.01M9 9V6M5.8 6H12.2C12.48 6 12.62 6 12.727 5.9455C12.8211 5.89757 12.8976 5.82108 12.9455 5.727C13 5.62004 13 5.48003 13 5.2V3.8C13 3.51997 13 3.37996 12.9455 3.273C12.8976 3.17892 12.8211 3.10243 12.727 3.0545C12.62 3 12.48 3 12.2 3H5.8C5.51997 3 5.37996 3 5.273 3.0545C5.17892 3.10243 5.10243 3.17892 5.0545 3.273C5 3.37996 5 3.51997 5 3.8V5.2C5 5.48003 5 5.62004 5.0545 5.727C5.10243 5.82108 5.17892 5.89757 5.273 5.9455C5.37996 6 5.51997 6 5.8 6Z' },
            { key: 'pos_sessions', label: 'Sesiones de Caja', path: '/pos/sessions', permission_prefix: 'pos_sessions', sort_order: 1, icon: 'M15.5 1.9q-1.8 0-3.4 1a6.4 6.4 0 0 0-2.8 7.7l-6.7 6.8a2 2 0 0 0-.7 1.4V21Q2 22 3 22h3q1 0 1-1v-1q.1-.9 1-1h1q1 0 1-1v-1q.1-.9 1-1h.2q.8 0 1.4-.6l.8-.7a6.4 6.4 0 0 0 7.7-2.8 6.4 6.4 0 0 0-1-8 6 6 0 0 0-4.6-2m0 0a6 6 0 0 1 4.6 2 6 6 0 0 1 .9 8 6 6 0 0 1-7.6 2.7l-.8.8a2 2 0 0 1-1.4.5H11a1 1 0 0 0-1 1.1v1q-.1.9-1 1H8a1 1 0 0 0-1 1v1q-.1.9-1 1H3a1 1 0 0 1-1-1v-2.2q0-.8.6-1.4l6.8-6.8A6 6 0 0 1 12.1 3q1.5-1 3.4-1m1 5a.6.6 0 0 0 0 1.2.6.6 0 0 0 0-1.2' },
            { key: 'pos_history', label: 'Historial de Ventas', path: '/pos/history', permission_prefix: 'pos_history', sort_order: 2, icon: 'M6 2a2 2 0 0 0-2 2v16q.2 1.8 2 2h12q1.8-.2 2-2V8q0-1-.7-1.7l-3.6-3.6q-.6-.7-1.7-.8zm0 0h8v5q0 1 1 1h5v12c0 1-1 2-2 2H6c-1 0-2-1-2-2V4c0-1 1-2 2-2m8 0q1 0 1.7.7l3.6 3.6q.6.7.6 1.6H15a1 1 0 0 1-1-.9zm2.3 10-3.7 4.3-2.1-2.4h-.1l-2.6 3v.1l2.6-3 2.1 2.4 3.8-4.3' },
        ],
    },
    {
        key: 'finance',
        label: 'Finanzas',
        icon: 'M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
        permission_prefix: 'finance',
        sort_order: 80,
        children: [
            { key: 'accounts_receivable', label: 'Cuentas por Cobrar', path: '/receivable', permission_prefix: 'receivable', sort_order: 0, icon: 'M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z' },
            { key: 'accounts_payable', label: 'Cuentas por Pagar', path: '/payable', permission_prefix: 'payable', sort_order: 1, icon: 'M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z' },
            { key: 'electronic_docs', label: 'Documentos Electrónicos', path: '/documents', permission_prefix: 'documents', sort_order: 3, icon: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z' },
        ],
    },
    {
        key: 'hr',
        label: 'Talento Humano',
        icon: 'M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z',
        permission_prefix: 'hr',
        sort_order: 90,
        children: [
            { key: 'payroll', label: 'Nómina de Empleados', path: '/payroll', permission_prefix: 'payroll', sort_order: 0, icon: 'M10 2a2 2 0 0 0-2 2v2H4a2 2 0 0 0-2 2v10q.2 1.8 2 2h16q1.8-.2 2-2V8q-.2-1.8-2-2h-4V4q-.2-1.8-2-2zm0 0h4c1 0 2 1 2 2v2H8V4c0-1 1-2 2-2M4 6h16c1 0 2 1 2 2v5c-6 4-14 4-20 0V8c0-1 1-2 2-2m8 5.9zl.1.1.1-.1zM2 13.1c6.1 4 13.9 4 20 0V18c0 1-1 2-2 2H4c-1 0-2-1-2-2z' },
            { key: 'schedules', label: 'Control de Horarios', path: '/schedules', permission_prefix: 'schedules', sort_order: 1, icon: 'M8 2v2H5a2 2 0 0 0-2 2v14q.2 1.8 2 2h3.5H5c-1 0-2-1-2-2V10h5-5V6c0-1 1-2 2-2h3v2-2h8v2-2h3c1 0 2 1 2 2v1.5V6q-.2-1.8-2-2h-3V2v2H8zm8 8a6 6 0 1 0 0 12 6 6 0 0 0 0-12m0 0a6 6 0 1 1 0 12 6 6 0 0 1 0-12m0 4v2.2l1.6 1-1.5-1z' },
            { key: 'hours_report', label: 'Reporte de Horas', path: '/hours', permission_prefix: 'hours', sort_order: 2, icon: 'M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z' },
        ],
    },
    {
        key: 'system',
        label: 'Sistema',
        icon: 'm16.5 2.3.3.9a3 3 0 0 0-1.6 1.6l-.9-.4v.1l.9.4a3 3 0 0 0 0 2.2l-1 .4h.1l.9-.3a3 3 0 0 0 1.6 1.6l-.4.9h.1l.4-.9a3 3 0 0 0 2.2 0l.4 1v-.1l-.3-.9a3 3 0 0 0 1.6-1.6l.9.4v-.1l-.9-.4a3 3 0 0 0 0-2.2l1-.4h-.1l-.9.3a3 3 0 0 0-1.6-1.6l.4-.9h-.1l-.4.9a3 3 0 0 0-2.2 0zM4 2.9A2 2 0 0 0 2 5v10q.2 1.8 2 2h8v4H8h8-4v-4h8q1.8-.2 2-2v-2 2c0 1-1 2-2 2H4c-1 0-2-1-2-2V5c0-1 1-2 2-2h7zm14 .2a3 3 0 1 1 0 5.8 3 3 0 0 1 0-5.8',
        permission_prefix: 'system',
        sort_order: 100,
        children: [
            { key: 'general_config', label: 'Configuración General', path: '/settings', permission_prefix: 'config', sort_order: 0, icon: 'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z' },
            { key: 'users_roles', label: 'Usuarios y Roles', path: '/users', permission_prefix: 'users', sort_order: 1, icon: 'M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z' },
            { key: 'audit', label: 'Auditoría', path: '/system/audit', permission_prefix: 'audit', sort_order: 3, icon: 'M9 2a1 1 0 0 0-1 1v1H6a2 2 0 0 0-2 2v14q.2 1.8 2 2h2-2c-1 0-2-1-2-2V6c0-1 1-2 2-2h2v1q0 1 1 1h6q1 0 1-1V4h2c1 0 2 1 2 2v.8V6q-.2-1.8-2-2h-2V3q0-1-1-1zm0 0h6q.9.1 1 1v2q-.1.9-1 1H9a1 1 0 0 1-1-1V3q.1-.9 1-1m7 8a6 6 0 1 0 0 12 6 6 0 0 0 0-12m0 0a6 6 0 1 1 0 12 6 6 0 0 1 0-12m0 4v2.2l1.6 1-1.5-1z' },
        ],
    },
];
