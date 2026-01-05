// src/seeds/seed.ts
// Run with: bun run db:seed
import { db } from '../db';
import { authPermissions, authRoles, authRolePermissions, authUserRoles } from '../schema';
import { sql } from 'drizzle-orm';

// ============================================
// RBAC SEED DATA FOR ERP SYSTEM
// ============================================

const PERMISSIONS = [
    // Dashboard
    { slug: 'dashboard.read', description: 'Ver panel de control' },
    { slug: 'dashboard.add', description: 'Crear elementos en dashboard' },
    { slug: 'dashboard.edit', description: 'Editar elementos en dashboard' },
    { slug: 'dashboard.delete', description: 'Eliminar elementos en dashboard' },

    // CRM
    { slug: 'crm.read', description: 'Ver módulo CRM' },
    { slug: 'crm.add', description: 'Crear en CRM' },
    { slug: 'crm.edit', description: 'Editar en CRM' },
    { slug: 'crm.delete', description: 'Eliminar en CRM' },

    // Clients
    { slug: 'clients.read', description: 'Ver clientes' },
    { slug: 'clients.add', description: 'Crear clientes' },
    { slug: 'clients.edit', description: 'Editar clientes' },
    { slug: 'clients.delete', description: 'Eliminar clientes' },

    // Technical Visits
    { slug: 'visits.read', description: 'Ver visitas técnicas' },
    { slug: 'visits.add', description: 'Crear visitas técnicas' },
    { slug: 'visits.edit', description: 'Editar visitas técnicas' },
    { slug: 'visits.delete', description: 'Eliminar visitas técnicas' },

    // Budgets/Quotations
    { slug: 'budgets.read', description: 'Ver presupuestos' },
    { slug: 'budgets.add', description: 'Crear presupuestos' },
    { slug: 'budgets.edit', description: 'Editar presupuestos' },
    { slug: 'budgets.delete', description: 'Eliminar presupuestos' },

    // Invoices
    { slug: 'invoices.read', description: 'Ver facturas' },
    { slug: 'invoices.add', description: 'Crear facturas' },
    { slug: 'invoices.edit', description: 'Editar facturas' },
    { slug: 'invoices.delete', description: 'Anular facturas' },

    // Operations
    { slug: 'operations.read', description: 'Ver operaciones' },
    { slug: 'operations.add', description: 'Crear operaciones' },
    { slug: 'operations.edit', description: 'Editar operaciones' },
    { slug: 'operations.delete', description: 'Eliminar operaciones' },

    // Work Orders
    { slug: 'work_orders.read', description: 'Ver órdenes de trabajo' },
    { slug: 'work_orders.add', description: 'Crear órdenes de trabajo' },
    { slug: 'work_orders.edit', description: 'Editar órdenes de trabajo' },
    { slug: 'work_orders.delete', description: 'Eliminar órdenes de trabajo' },

    // Schedule
    { slug: 'schedule.read', description: 'Ver cronograma' },
    { slug: 'schedule.add', description: 'Crear eventos en cronograma' },
    { slug: 'schedule.edit', description: 'Editar eventos en cronograma' },
    { slug: 'schedule.delete', description: 'Eliminar eventos en cronograma' },

    // Projects
    { slug: 'projects.read', description: 'Ver historial de proyectos' },
    { slug: 'projects.add', description: 'Crear proyectos' },
    { slug: 'projects.edit', description: 'Editar proyectos' },
    { slug: 'projects.delete', description: 'Eliminar proyectos' },

    // Production
    { slug: 'production.read', description: 'Ver producción' },
    { slug: 'production.add', description: 'Crear producción' },
    { slug: 'production.edit', description: 'Editar producción' },
    { slug: 'production.delete', description: 'Eliminar producción' },

    // Planning
    { slug: 'planning.read', description: 'Ver planificación' },
    { slug: 'planning.add', description: 'Crear planificación' },
    { slug: 'planning.edit', description: 'Editar planificación' },
    { slug: 'planning.delete', description: 'Eliminar planificación' },

    // Materials
    { slug: 'materials.read', description: 'Ver solicitudes de materiales' },
    { slug: 'materials.add', description: 'Crear solicitudes de materiales' },
    { slug: 'materials.edit', description: 'Editar solicitudes de materiales' },
    { slug: 'materials.delete', description: 'Eliminar solicitudes de materiales' },

    // Quality Control
    { slug: 'quality.read', description: 'Ver control de calidad' },
    { slug: 'quality.add', description: 'Crear control de calidad' },
    { slug: 'quality.edit', description: 'Editar control de calidad' },
    { slug: 'quality.delete', description: 'Eliminar control de calidad' },

    // Inventory
    { slug: 'inventory.read', description: 'Ver inventario' },
    { slug: 'inventory.add', description: 'Crear inventario' },
    { slug: 'inventory.edit', description: 'Editar inventario' },
    { slug: 'inventory.delete', description: 'Eliminar inventario' },

    // Products
    { slug: 'products.read', description: 'Ver productos' },
    { slug: 'products.add', description: 'Crear productos' },
    { slug: 'products.edit', description: 'Editar productos' },
    { slug: 'products.delete', description: 'Eliminar productos' },

    // Movements
    { slug: 'movements.read', description: 'Ver movimientos' },
    { slug: 'movements.add', description: 'Crear movimientos' },
    { slug: 'movements.edit', description: 'Editar movimientos' },
    { slug: 'movements.delete', description: 'Eliminar movimientos' },

    // Orders
    { slug: 'orders.read', description: 'Ver pedidos de material' },
    { slug: 'orders.add', description: 'Crear pedidos de material' },
    { slug: 'orders.edit', description: 'Editar pedidos de material' },
    { slug: 'orders.delete', description: 'Eliminar pedidos de material' },

    // Stock Taking
    { slug: 'stock_taking.read', description: 'Ver toma física' },
    { slug: 'stock_taking.add', description: 'Crear toma física' },
    { slug: 'stock_taking.edit', description: 'Editar toma física' },
    { slug: 'stock_taking.delete', description: 'Eliminar toma física' },

    // Remission Guides
    { slug: 'remission_guides.read', description: 'Ver guías de remisión' },
    { slug: 'remission_guides.add', description: 'Crear guías de remisión' },
    { slug: 'remission_guides.edit', description: 'Editar guías de remisión' },
    { slug: 'remission_guides.delete', description: 'Eliminar guías de remisión' },

    // Purchases
    { slug: 'purchases.read', description: 'Ver compras' },
    { slug: 'purchases.add', description: 'Crear compras' },
    { slug: 'purchases.edit', description: 'Editar compras' },
    { slug: 'purchases.delete', description: 'Eliminar compras' },

    // Suppliers
    { slug: 'suppliers.read', description: 'Ver proveedores' },
    { slug: 'suppliers.add', description: 'Crear proveedores' },
    { slug: 'suppliers.edit', description: 'Editar proveedores' },
    { slug: 'suppliers.delete', description: 'Eliminar proveedores' },

    // Purchase Quotes
    { slug: 'purchase_quotes.read', description: 'Ver cotizaciones de compra' },
    { slug: 'purchase_quotes.add', description: 'Crear cotizaciones de compra' },
    { slug: 'purchase_quotes.edit', description: 'Editar cotizaciones de compra' },
    { slug: 'purchase_quotes.delete', description: 'Eliminar cotizaciones de compra' },

    // Purchase Orders
    { slug: 'purchase_orders.read', description: 'Ver órdenes de compra' },
    { slug: 'purchase_orders.add', description: 'Crear órdenes de compra' },
    { slug: 'purchase_orders.edit', description: 'Editar órdenes de compra' },
    { slug: 'purchase_orders.delete', description: 'Eliminar órdenes de compra' },

    // Purchase Invoices
    { slug: 'purchase_invoices.read', description: 'Ver recepción de facturas' },
    { slug: 'purchase_invoices.add', description: 'Registrar facturas de compra' },
    { slug: 'purchase_invoices.edit', description: 'Editar facturas de compra' },
    { slug: 'purchase_invoices.delete', description: 'Eliminar facturas de compra' },

    // Finance
    { slug: 'finance.read', description: 'Ver finanzas' },
    { slug: 'finance.add', description: 'Crear en finanzas' },
    { slug: 'finance.edit', description: 'Editar en finanzas' },
    { slug: 'finance.delete', description: 'Eliminar en finanzas' },

    // Documents
    { slug: 'documents.read', description: 'Ver documentos electrónicos' },
    { slug: 'documents.add', description: 'Crear documentos electrónicos' },
    { slug: 'documents.edit', description: 'Editar documentos electrónicos' },
    { slug: 'documents.delete', description: 'Eliminar documentos electrónicos' },

    // Retentions
    { slug: 'retentions.read', description: 'Ver retenciones' },
    { slug: 'retentions.add', description: 'Crear retenciones' },
    { slug: 'retentions.edit', description: 'Editar retenciones' },
    { slug: 'retentions.delete', description: 'Eliminar retenciones' },

    // Accounts Receivable
    { slug: 'receivable.read', description: 'Ver cuentas por cobrar' },
    { slug: 'receivable.add', description: 'Crear cuentas por cobrar' },
    { slug: 'receivable.edit', description: 'Editar cuentas por cobrar' },
    { slug: 'receivable.delete', description: 'Eliminar cuentas por cobrar' },

    // Accounts Payable
    { slug: 'payable.read', description: 'Ver cuentas por pagar' },
    { slug: 'payable.add', description: 'Crear cuentas por pagar' },
    { slug: 'payable.edit', description: 'Editar cuentas por pagar' },
    { slug: 'payable.delete', description: 'Eliminar cuentas por pagar' },

    // Petty Cash
    { slug: 'petty_cash.read', description: 'Ver caja chica' },
    { slug: 'petty_cash.add', description: 'Crear movimientos caja chica' },
    { slug: 'petty_cash.edit', description: 'Editar movimientos caja chica' },
    { slug: 'petty_cash.delete', description: 'Eliminar movimientos caja chica' },

    // HR
    { slug: 'hr.read', description: 'Ver talento humano' },
    { slug: 'hr.add', description: 'Crear en talento humano' },
    { slug: 'hr.edit', description: 'Editar en talento humano' },
    { slug: 'hr.delete', description: 'Eliminar en talento humano' },

    // Payroll
    { slug: 'payroll.read', description: 'Ver nómina' },
    { slug: 'payroll.add', description: 'Crear nómina' },
    { slug: 'payroll.edit', description: 'Editar nómina' },
    { slug: 'payroll.delete', description: 'Eliminar nómina' },

    // Schedules
    { slug: 'schedules.read', description: 'Ver control de horarios' },
    { slug: 'schedules.add', description: 'Crear horarios' },
    { slug: 'schedules.edit', description: 'Editar horarios' },
    { slug: 'schedules.delete', description: 'Eliminar horarios' },

    // Hours Report
    { slug: 'hours.read', description: 'Ver reporte de horas' },
    { slug: 'hours.add', description: 'Crear reporte de horas' },
    { slug: 'hours.edit', description: 'Editar reporte de horas' },
    { slug: 'hours.delete', description: 'Eliminar reporte de horas' },

    // System
    { slug: 'system.read', description: 'Ver sistema' },
    { slug: 'system.add', description: 'Crear en sistema' },
    { slug: 'system.edit', description: 'Editar en sistema' },
    { slug: 'system.delete', description: 'Eliminar en sistema' },

    // Config
    { slug: 'config.read', description: 'Ver configuración' },
    { slug: 'config.add', description: 'Crear configuración' },
    { slug: 'config.edit', description: 'Editar configuración' },
    { slug: 'config.delete', description: 'Eliminar configuración' },

    // Users
    { slug: 'users.read', description: 'Ver usuarios' },
    { slug: 'users.add', description: 'Crear usuarios' },
    { slug: 'users.edit', description: 'Editar usuarios' },
    { slug: 'users.delete', description: 'Eliminar usuarios' },

    // Audit
    { slug: 'audit.read', description: 'Ver auditoría' },
    { slug: 'audit.add', description: 'Crear auditoría' },
    { slug: 'audit.edit', description: 'Editar auditoría' },
    { slug: 'audit.delete', description: 'Eliminar auditoría' },

    // Roles Management
    { slug: 'roles.read', description: 'Ver roles' },
    { slug: 'roles.add', description: 'Crear roles' },
    { slug: 'roles.edit', description: 'Editar roles' },
    { slug: 'roles.delete', description: 'Eliminar roles' },

    // Permissions Management
    { slug: 'permissions.read', description: 'Ver permisos' },
    { slug: 'permissions.add', description: 'Asignar permisos' },
    { slug: 'permissions.edit', description: 'Modificar asignación de permisos' },
    { slug: 'permissions.delete', description: 'Revocar permisos' },
];

const ROLES = [
    { name: 'superadmin', description: 'Super Administrador con acceso total al sistema' },
    { name: 'admin', description: 'Administrador del sistema' },
    { name: 'gerente', description: 'Gerente con acceso a reportes y aprobaciones' },
    { name: 'ventas', description: 'Equipo de ventas y CRM' },
    { name: 'produccion', description: 'Equipo de producción y manufactura' },
    { name: 'inventario', description: 'Gestión de inventario y almacén' },
    { name: 'contabilidad', description: 'Equipo de finanzas y contabilidad' },
    { name: 'rrhh', description: 'Recursos Humanos' },
];

// Role permission mappings
const ROLE_PERMISSIONS: Record<string, (slug: string) => boolean> = {
    superadmin: () => true, // All permissions

    admin: (slug) => {
        // All except dangerous deletes
        const blocked = ['system.delete', 'config.delete', 'users.delete', 'roles.delete', 'permissions.delete'];
        return !blocked.includes(slug) && !slug.endsWith('.delete');
    },

    gerente: (slug) => {
        return slug.startsWith('dashboard.') ||
            slug === 'crm.read' ||
            slug.startsWith('clients.') ||
            slug === 'invoices.read' ||
            slug === 'finance.read' ||
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
            slug.startsWith('production.') ||
            slug.startsWith('planning.') ||
            slug.startsWith('work_orders.') ||
            slug.startsWith('materials.') ||
            slug.startsWith('quality.');
    },

    inventario: (slug) => {
        return slug === 'dashboard.read' ||
            slug.startsWith('inventory.') ||
            slug.startsWith('products.') ||
            slug.startsWith('movements.') ||
            slug.startsWith('orders.') ||
            slug.startsWith('stock_taking.') ||
            slug.startsWith('remission_guides.');
    },

    contabilidad: (slug) => {
        return slug === 'dashboard.read' ||
            slug.startsWith('finance.') ||
            slug.startsWith('invoices.') ||
            slug.startsWith('documents.') ||
            slug.startsWith('retentions.') ||
            slug.startsWith('receivable.') ||
            slug.startsWith('payable.') ||
            slug.startsWith('petty_cash.') ||
            slug.startsWith('purchases.');
    },

    rrhh: (slug) => {
        return slug === 'dashboard.read' ||
            slug.startsWith('hr.') ||
            slug.startsWith('payroll.') ||
            slug.startsWith('schedules.') ||
            slug.startsWith('hours.');
    },
};

async function seed() {
    console.log('🌱 Starting RBAC seed...');

    try {
        // 1. Insert permissions (upsert)
        console.log('📝 Inserting permissions...');
        for (const perm of PERMISSIONS) {
            await db
                .insert(authPermissions)
                .values(perm)
                .onConflictDoNothing({ target: authPermissions.slug });
        }
        console.log(`   ✅ ${PERMISSIONS.length} permissions processed`);

        // 2. Insert roles (upsert)
        console.log('👥 Inserting roles...');
        for (const role of ROLES) {
            await db
                .insert(authRoles)
                .values(role)
                .onConflictDoNothing({ target: authRoles.name });
        }
        console.log(`   ✅ ${ROLES.length} roles processed`);

        // 3. Get all permissions and roles from DB
        const allPermissions = await db.select().from(authPermissions);
        const allRoles = await db.select().from(authRoles);

        const permMap = new Map(allPermissions.map(p => [p.slug, p.id]));
        const roleMap = new Map(allRoles.map(r => [r.name, r.id]));

        // 4. Assign permissions to roles
        console.log('🔗 Assigning permissions to roles...');
        for (const [roleName, checkFn] of Object.entries(ROLE_PERMISSIONS)) {
            const roleId = roleMap.get(roleName);
            if (!roleId) continue;

            const permissionsForRole = PERMISSIONS
                .filter(p => checkFn(p.slug))
                .map(p => permMap.get(p.slug))
                .filter((id): id is number => id !== undefined);

            for (const permissionId of permissionsForRole) {
                await db
                    .insert(authRolePermissions)
                    .values({ role_id: roleId, permission_id: permissionId })
                    .onConflictDoNothing();
            }

            console.log(`   ✅ ${roleName}: ${permissionsForRole.length} permissions`);
        }

        // 5. Assign superadmin role to user ID 1 (if exists)
        console.log('👤 Assigning superadmin to user ID 1...');
        const superadminRoleId = roleMap.get('superadmin');
        if (superadminRoleId) {
            await db
                .insert(authUserRoles)
                .values({ user_id: 1, role_id: superadminRoleId })
                .onConflictDoNothing();
            console.log('   ✅ User ID 1 is now superadmin');
        }

        console.log('\n✅ RBAC seed completed successfully!');

        // Verification
        const permCount = await db.select({ count: sql<number>`count(*)` }).from(authPermissions);
        const roleCount = await db.select({ count: sql<number>`count(*)` }).from(authRoles);
        console.log(`\n📊 Summary:`);
        console.log(`   - Total permissions: ${permCount[0].count}`);
        console.log(`   - Total roles: ${roleCount[0].count}`);

    } catch (error) {
        console.error('❌ Seed failed:', error);
        process.exit(1);
    }

    process.exit(0);
}

seed();
