// src/seeds/menu-seed.ts
// Run with: bun run src/seeds/menu-seed.ts
import { db } from '../db';
import { authMenuItems } from '../schema';
import { sql } from 'drizzle-orm';

// ============================================
// MENU ITEMS SEED - Based on menu.ts config
// ============================================

interface MenuSeedItem {
    key: string;
    label: string;
    icon: string;
    path?: string;
    permission_prefix?: string;
    sort_order: number;
    children?: MenuSeedItem[];
}

const MENU_ITEMS: MenuSeedItem[] = [
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
        key: 'operations',
        label: 'Operaciones',
        icon: 'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z',
        permission_prefix: 'operations',
        sort_order: 20,
        children: [
            { key: 'work_orders', label: 'Orden de Trabajo', path: '/work-orders', permission_prefix: 'work_orders', sort_order: 0, icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01' },
            { key: 'schedule', label: 'Cronograma', path: '/order-schedule', permission_prefix: 'schedule', sort_order: 1, icon: 'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z' },
            { key: 'project_history', label: 'Historial de Proyectos', path: '/history', permission_prefix: 'projects', sort_order: 2, icon: 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z' },
        ],
    },
    {
        key: 'production',
        label: 'Producción',
        icon: 'M19.428 15.428a2 2 0 00-1.022-.547l-2.384-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z',
        permission_prefix: 'production',
        sort_order: 30,
        children: [
            { key: 'planning', label: 'Planificación', path: '/planning', permission_prefix: 'planning', sort_order: 0, icon: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z' },
            { key: 'tool_request', label: 'Solicitud Herramientas/Material', path: '/requests', permission_prefix: 'materials', sort_order: 1, icon: 'M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z' },
            { key: 'quality_control', label: 'Control de Calidad', path: '/quality', permission_prefix: 'quality', sort_order: 2, icon: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z' },
        ],
    },
    {
        key: 'inventory',
        label: 'Inventario',
        icon: 'M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4',
        permission_prefix: 'inventory',
        sort_order: 40,
        children: [
            { key: 'products', label: 'Productos', path: '/products', permission_prefix: 'products', sort_order: 0, icon: 'M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4' },
            { key: 'movements', label: 'Movimientos', path: '/movements', permission_prefix: 'movements', sort_order: 1, icon: 'M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4' },
            { key: 'material_orders', label: 'Pedido de Material', path: '/orders', permission_prefix: 'orders', sort_order: 2, icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2' },
            { key: 'stock_taking', label: 'Toma Física', path: '/stock-taking', permission_prefix: 'stock_taking', sort_order: 3, icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4' },
            { key: 'shipping_guides', label: 'Guías de Remisión', path: '/shipping-guides', permission_prefix: 'remission_guides', sort_order: 4, icon: 'M9 17a2 2 0 11-4 0 2 2 0 014 0zM19 17a2 2 0 11-4 0 2 2 0 014 0z' },
        ],
    },
    {
        key: 'purchases',
        label: 'Compras y Gastos',
        icon: 'M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z',
        permission_prefix: 'purchases',
        sort_order: 50,
        children: [
            { key: 'suppliers', label: 'Proveedores', path: '/suppliers', permission_prefix: 'suppliers', sort_order: 0, icon: 'M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4' },
            { key: 'purchase_quotes', label: 'Cotización de Compra', path: '/purchase-quotes', permission_prefix: 'purchase_quotes', sort_order: 1, icon: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z' },
            { key: 'purchase_orders', label: 'Órdenes de Compra', path: '/purchase-orders', permission_prefix: 'purchase_orders', sort_order: 2, icon: 'M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z' },
            { key: 'invoice_reception', label: 'Recepción de Facturas', path: '/purchase-invoices', permission_prefix: 'purchase_invoices', sort_order: 3, icon: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z' },
        ],
    },
    {
        key: 'finance',
        label: 'Finanzas',
        icon: 'M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
        permission_prefix: 'finance',
        sort_order: 60,
        children: [
            { key: 'electronic_docs', label: 'Documentos Electrónicos', path: '/documents', permission_prefix: 'documents', sort_order: 0, icon: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z' },
            { key: 'retentions', label: 'Retenciones', path: '/retentions', permission_prefix: 'retentions', sort_order: 1, icon: 'M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z' },
            { key: 'accounts_receivable', label: 'Cuentas por Cobrar', path: '/receivable', permission_prefix: 'receivable', sort_order: 2, icon: 'M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z' },
            { key: 'accounts_payable', label: 'Cuentas por Pagar', path: '/payable', permission_prefix: 'payable', sort_order: 3, icon: 'M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z' },
            { key: 'petty_cash', label: 'Caja Chica', path: '/petty-cash', permission_prefix: 'petty_cash', sort_order: 4, icon: 'M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z' },
        ],
    },
    {
        key: 'hr',
        label: 'Talento Humano',
        icon: 'M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z',
        permission_prefix: 'hr',
        sort_order: 70,
        children: [
            { key: 'payroll', label: 'Nómina de Empleados', path: '/payroll', permission_prefix: 'payroll', sort_order: 0, icon: 'M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z' },
            { key: 'schedules', label: 'Control de Horarios', path: '/schedules', permission_prefix: 'schedules', sort_order: 1, icon: 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z' },
            { key: 'hours_report', label: 'Reporte de Horas', path: '/hours', permission_prefix: 'hours', sort_order: 2, icon: 'M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z' },
        ],
    },
    {
        key: 'system',
        label: 'Sistema',
        icon: 'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z',
        permission_prefix: 'system',
        sort_order: 80,
        children: [
            { key: 'general_config', label: 'Configuración General', path: '/settings/general', permission_prefix: 'config', sort_order: 0, icon: 'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z' },
            { key: 'users_roles', label: 'Usuarios, Roles y Permisos', path: '/system/users', permission_prefix: 'users', sort_order: 1, icon: 'M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z' },
            { key: 'audit', label: 'Auditoría', path: '/system/audit', permission_prefix: 'audit', sort_order: 3, icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01' },
        ],
    },
];

async function seedMenuItems() {
    console.log('🌱 Starting Menu Items seed...');

    try {
        // First, insert all parent items (those without parent_id)
        console.log('📂 Inserting parent menu items...');
        const parentMap = new Map<string, number>();

        for (const item of MENU_ITEMS) {
            const [result] = await db
                .insert(authMenuItems)
                .values({
                    key: item.key,
                    label: item.label,
                    icon: item.icon,
                    path: item.path || null,
                    parent_id: null,
                    sort_order: item.sort_order,
                    permission_prefix: item.permission_prefix || null,
                })
                .onConflictDoUpdate({
                    target: authMenuItems.key,
                    set: {
                        label: item.label,
                        icon: item.icon,
                        path: item.path || null,
                        sort_order: item.sort_order,
                        permission_prefix: item.permission_prefix || null,
                        updated_at: new Date(),
                    }
                })
                .returning({ id: authMenuItems.id });

            parentMap.set(item.key, result.id);
            console.log(`   ✅ ${item.label} (id: ${result.id})`);
        }

        // Then, insert all children
        console.log('\n📁 Inserting child menu items...');
        for (const parent of MENU_ITEMS) {
            if (!parent.children) continue;

            const parentId = parentMap.get(parent.key);
            if (!parentId) continue;

            for (const child of parent.children) {
                const [result] = await db
                    .insert(authMenuItems)
                    .values({
                        key: child.key,
                        label: child.label,
                        icon: child.icon,
                        path: child.path || null,
                        parent_id: parentId,
                        sort_order: child.sort_order,
                        permission_prefix: child.permission_prefix || null,
                    })
                    .onConflictDoUpdate({
                        target: authMenuItems.key,
                        set: {
                            label: child.label,
                            icon: child.icon,
                            path: child.path || null,
                            parent_id: parentId,
                            sort_order: child.sort_order,
                            permission_prefix: child.permission_prefix || null,
                            updated_at: new Date(),
                        }
                    })
                    .returning({ id: authMenuItems.id });

                console.log(`   └─ ${child.label} (id: ${result.id})`);
            }
        }

        // Summary
        const menuCount = await db.select({ count: sql<number>`count(*)` }).from(authMenuItems);
        console.log(`\n✅ Menu seed completed!`);
        console.log(`📊 Total menu items: ${menuCount[0].count}`);
    } catch (error) {
        console.error('❌ Menu seed failed:', error);
        process.exit(1);
    }

    process.exit(0);
}

seedMenuItems();
