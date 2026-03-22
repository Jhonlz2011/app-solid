// src/seeds/seed.ts
// Run with: bun run db:seed
import { db } from '../db';
import { authPermissions, authRoles, authRolePermissions, authUserRoles, authUsers, uom, entities } from '@app/schema/tables';
import { sql } from '@app/schema';

// ============================================
// RBAC SEED DATA FOR ERP SYSTEM
// ============================================

/** Helper: derive module and action from slug */
function parsePerm(slug: string, description: string) {
    const [module, action] = slug.split('.');
    return { slug, module, action, description };
}

const PERMISSIONS = [
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
    parsePerm('clients.delete', 'Eliminar clientes'),

    // Technical Visits
    parsePerm('visits.read', 'Ver visitas técnicas'),
    parsePerm('visits.create', 'Crear visitas técnicas'),
    parsePerm('visits.update', 'Editar visitas técnicas'),
    parsePerm('visits.delete', 'Eliminar visitas técnicas'),

    // Budgets/Quotations
    parsePerm('budgets.read', 'Ver presupuestos'),
    parsePerm('budgets.create', 'Crear presupuestos'),
    parsePerm('budgets.update', 'Editar presupuestos'),
    parsePerm('budgets.delete', 'Eliminar presupuestos'),

    // Invoices
    parsePerm('invoices.read', 'Ver facturas'),
    parsePerm('invoices.create', 'Crear facturas'),
    parsePerm('invoices.update', 'Editar facturas'),
    parsePerm('invoices.delete', 'Anular facturas'),

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
    parsePerm('schedule.create', 'Crear eventos en cronograma'),
    parsePerm('schedule.update', 'Editar eventos en cronograma'),
    parsePerm('schedule.delete', 'Eliminar eventos en cronograma'),

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

    // Materials
    parsePerm('materials.read', 'Ver solicitudes de materiales'),
    parsePerm('materials.create', 'Crear solicitudes de materiales'),
    parsePerm('materials.update', 'Editar solicitudes de materiales'),
    parsePerm('materials.delete', 'Eliminar solicitudes de materiales'),

    // Quality Control
    parsePerm('quality.read', 'Ver control de calidad'),
    parsePerm('quality.create', 'Crear control de calidad'),
    parsePerm('quality.update', 'Editar control de calidad'),
    parsePerm('quality.delete', 'Eliminar control de calidad'),

    // Inventory
    parsePerm('inventory.read', 'Ver inventario'),
    parsePerm('inventory.create', 'Crear inventario'),
    parsePerm('inventory.update', 'Editar inventario'),
    parsePerm('inventory.delete', 'Eliminar inventario'),

    // Products
    parsePerm('products.read', 'Ver productos'),
    parsePerm('products.create', 'Crear productos'),
    parsePerm('products.update', 'Editar productos'),
    parsePerm('products.delete', 'Eliminar productos'),

    // Movements
    parsePerm('movements.read', 'Ver movimientos'),
    parsePerm('movements.create', 'Crear movimientos'),
    parsePerm('movements.update', 'Editar movimientos'),
    parsePerm('movements.delete', 'Eliminar movimientos'),

    // Orders
    parsePerm('orders.read', 'Ver pedidos de material'),
    parsePerm('orders.create', 'Crear pedidos de material'),
    parsePerm('orders.update', 'Editar pedidos de material'),
    parsePerm('orders.delete', 'Eliminar pedidos de material'),

    // Stock Taking
    parsePerm('stock_taking.read', 'Ver toma física'),
    parsePerm('stock_taking.create', 'Crear toma física'),
    parsePerm('stock_taking.update', 'Editar toma física'),
    parsePerm('stock_taking.delete', 'Eliminar toma física'),

    // Remission Guides
    parsePerm('remission_guides.read', 'Ver guías de remisión'),
    parsePerm('remission_guides.create', 'Crear guías de remisión'),
    parsePerm('remission_guides.update', 'Editar guías de remisión'),
    parsePerm('remission_guides.delete', 'Eliminar guías de remisión'),

    // Purchases
    parsePerm('purchases.read', 'Ver compras'),
    parsePerm('purchases.create', 'Crear compras'),
    parsePerm('purchases.update', 'Editar compras'),
    parsePerm('purchases.delete', 'Eliminar compras'),
    parsePerm('purchases.restore', 'Restaurar compras'),
    parsePerm('purchases.destroy', 'Eliminar compras permanentemente'),

    // Suppliers
    parsePerm('suppliers.read', 'Ver proveedores'),
    parsePerm('suppliers.create', 'Crear proveedores'),
    parsePerm('suppliers.update', 'Editar proveedores'),
    parsePerm('suppliers.delete', 'Eliminar proveedores'),
    parsePerm('suppliers.restore', 'Restaurar proveedores'),
    parsePerm('suppliers.destroy', 'Eliminar proveedores permanentemente'),

    // Purchase Quotes
    parsePerm('purchase_quotes.read', 'Ver cotizaciones de compra'),
    parsePerm('purchase_quotes.create', 'Crear cotizaciones de compra'),
    parsePerm('purchase_quotes.update', 'Editar cotizaciones de compra'),
    parsePerm('purchase_quotes.delete', 'Eliminar cotizaciones de compra'),
    parsePerm('purchase_quotes.restore', 'Restaurar cotizaciones de compra'),
    parsePerm('purchase_quotes.destroy', 'Eliminar cotizaciones de compra permanentemente'),

    // Purchase Orders
    parsePerm('purchase_orders.read', 'Ver órdenes de compra'),
    parsePerm('purchase_orders.create', 'Crear órdenes de compra'),
    parsePerm('purchase_orders.update', 'Editar órdenes de compra'),
    parsePerm('purchase_orders.delete', 'Eliminar órdenes de compra'),
    parsePerm('purchase_orders.restore', 'Restaurar órdenes de compra'),
    parsePerm('purchase_orders.destroy', 'Eliminar órdenes de compra permanentemente'),

    // Purchase Invoices
    parsePerm('purchase_invoices.read', 'Ver recepción de facturas'),
    parsePerm('purchase_invoices.create', 'Registrar facturas de compra'),
    parsePerm('purchase_invoices.update', 'Editar facturas de compra'),
    parsePerm('purchase_invoices.delete', 'Eliminar facturas de compra'),
    parsePerm('purchase_invoices.restore', 'Restaurar facturas de compra'),
    parsePerm('purchase_invoices.destroy', 'Eliminar facturas de compra permanentemente'),

    // Finance
    parsePerm('finance.read', 'Ver finanzas'),
    parsePerm('finance.create', 'Crear en finanzas'),
    parsePerm('finance.update', 'Editar en finanzas'),
    parsePerm('finance.delete', 'Eliminar en finanzas'),
    parsePerm('finance.restore', 'Restaurar finanzas'),
    parsePerm('finance.destroy', 'Eliminar finanzas permanentemente'),

    // Documents
    parsePerm('documents.read', 'Ver documentos electrónicos'),
    parsePerm('documents.create', 'Crear documentos electrónicos'),
    parsePerm('documents.update', 'Editar documentos electrónicos'),
    parsePerm('documents.delete', 'Eliminar documentos electrónicos'),
    parsePerm('documents.restore', 'Restaurar documentos electrónicos'),
    parsePerm('documents.destroy', 'Eliminar documentos electrónicos permanentemente'),

    // Retentions
    parsePerm('retentions.read', 'Ver retenciones'),
    parsePerm('retentions.create', 'Crear retenciones'),
    parsePerm('retentions.update', 'Editar retenciones'),
    parsePerm('retentions.delete', 'Eliminar retenciones'),
    parsePerm('retentions.restore', 'Restaurar retenciones'),
    parsePerm('retentions.destroy', 'Eliminar retenciones permanentemente'),

    // Accounts Receivable
    parsePerm('receivable.read', 'Ver cuentas por cobrar'),
    parsePerm('receivable.create', 'Crear cuentas por cobrar'),
    parsePerm('receivable.update', 'Editar cuentas por cobrar'),
    parsePerm('receivable.delete', 'Eliminar cuentas por cobrar'),
    parsePerm('receivable.restore', 'Restaurar cuentas por cobrar'),
    parsePerm('receivable.destroy', 'Eliminar cuentas por cobrar permanentemente'),

    // Accounts Payable
    parsePerm('payable.read', 'Ver cuentas por pagar'),
    parsePerm('payable.create', 'Crear cuentas por pagar'),
    parsePerm('payable.update', 'Editar cuentas por pagar'),
    parsePerm('payable.delete', 'Eliminar cuentas por pagar'),
    parsePerm('payable.restore', 'Restaurar cuentas por pagar'),
    parsePerm('payable.destroy', 'Eliminar cuentas por pagar permanentemente'),

    // Petty Cash
    parsePerm('petty_cash.read', 'Ver caja chica'),
    parsePerm('petty_cash.create', 'Crear movimientos caja chica'),
    parsePerm('petty_cash.update', 'Editar movimientos caja chica'),
    parsePerm('petty_cash.delete', 'Eliminar movimientos caja chica'),
    parsePerm('petty_cash.restore', 'Restaurar movimientos caja chica'),
    parsePerm('petty_cash.destroy', 'Eliminar movimientos caja chica permanentemente'),

    // HR
    parsePerm('hr.read', 'Ver talento humano'),
    parsePerm('hr.create', 'Crear en talento humano'),
    parsePerm('hr.update', 'Editar en talento humano'),
    parsePerm('hr.delete', 'Eliminar en talento humano'),
    parsePerm('hr.restore', 'Restaurar talento humano'),
    parsePerm('hr.destroy', 'Eliminar talento humano permanentemente'),

    // Payroll
    parsePerm('payroll.read', 'Ver nómina'),
    parsePerm('payroll.create', 'Crear nómina'),
    parsePerm('payroll.update', 'Editar nómina'),
    parsePerm('payroll.delete', 'Eliminar nómina'),
    parsePerm('payroll.restore', 'Restaurar nómina'),
    parsePerm('payroll.destroy', 'Eliminar nómina permanentemente'),

    // Schedules
    parsePerm('schedules.read', 'Ver control de horarios'),
    parsePerm('schedules.create', 'Crear horarios'),
    parsePerm('schedules.update', 'Editar horarios'),
    parsePerm('schedules.delete', 'Eliminar horarios'),
    parsePerm('schedules.restore', 'Restaurar horarios'),
    parsePerm('schedules.destroy', 'Eliminar horarios permanentemente'),

    // Hours Report
    parsePerm('hours.read', 'Ver reporte de horas'),
    parsePerm('hours.create', 'Crear reporte de horas'),
    parsePerm('hours.update', 'Editar reporte de horas'),
    parsePerm('hours.delete', 'Eliminar reporte de horas'),
    parsePerm('hours.restore', 'Restaurar reporte de horas'),
    parsePerm('hours.destroy', 'Eliminar reporte de horas permanentemente'),

    // System
    parsePerm('system.read', 'Ver sistema'),
    parsePerm('system.create', 'Crear en sistema'),
    parsePerm('system.update', 'Editar en sistema'),
    parsePerm('system.delete', 'Eliminar en sistema'),

    // Config
    parsePerm('config.read', 'Ver configuración'),
    parsePerm('config.create', 'Crear configuración'),
    parsePerm('config.update', 'Editar configuración'),
    parsePerm('config.delete', 'Eliminar configuración'),

    // Users
    parsePerm('users.read', 'Ver usuarios'),
    parsePerm('users.create', 'Crear usuarios'),
    parsePerm('users.update', 'Editar usuarios'),
    parsePerm('users.delete', 'Eliminar usuarios'),
    parsePerm('users.restore', 'Restaurar usuarios'),
    parsePerm('users.destroy', 'Eliminar usuarios permanentemente'),

    // Audit
    parsePerm('audit.read', 'Ver auditoría'),
    parsePerm('audit.create', 'Crear auditoría'),
    parsePerm('audit.update', 'Editar auditoría'),
    parsePerm('audit.delete', 'Eliminar auditoría'),
    parsePerm('audit.restore', 'Restaurar auditoría'),
    parsePerm('audit.destroy', 'Eliminar auditoría permanentemente'),

    // Roles Management
    parsePerm('roles.read', 'Ver roles'),
    parsePerm('roles.create', 'Crear roles'),
    parsePerm('roles.update', 'Editar roles'),
    parsePerm('roles.delete', 'Eliminar roles'),
    parsePerm('roles.restore', 'Restaurar roles'),
    parsePerm('roles.destroy', 'Eliminar roles permanentemente'),

    // Permissions Management
    parsePerm('permissions.read', 'Ver permisos'),
    parsePerm('permissions.create', 'Asignar permisos'),
    parsePerm('permissions.update', 'Modificar asignación de permisos'),
    parsePerm('permissions.delete', 'Revocar permisos'),
];

const ROLES = [
    { name: 'superadmin', description: 'Super Administrador con acceso total al sistema', is_system: true },
    { name: 'admin', description: 'Administrador del sistema', is_system: true },
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

const UOM_DATA = [
    // Length
    { code: 'M', name: 'Metro' },
    { code: 'CM', name: 'Centímetro' },
    { code: 'MM', name: 'Milímetro' },
    // Area
    { code: 'M2', name: 'Metro Cuadrado' },
    // Volume
    { code: 'M3', name: 'Metro Cúbico' },
    { code: 'L', name: 'Litro' },
    { code: 'GAL', name: 'Galón' },
    // Weight
    { code: 'KG', name: 'Kilogramo' },
    { code: 'G', name: 'Gramo' },
    { code: 'LB', name: 'Libra' },
    // Quantity
    { code: 'UND', name: 'Unidad' },
    { code: 'PZA', name: 'Pieza' },
    { code: 'JGO', name: 'Juego' },
    { code: 'CAJA', name: 'Caja' },
    { code: 'PAQ', name: 'Paquete' },
    { code: 'ROLLO', name: 'Rollo' },
];

async function seed() {
    console.log('🌱 Starting RBAC seed...');

    try {
        // 0. Insert UOMs
        console.log('📏 Inserting UOMs...');
        for (const unit of UOM_DATA) {
            await db
                .insert(uom)
                .values(unit)
                .onConflictDoNothing({ target: uom.code });
        }
        console.log(`   ✅ ${UOM_DATA.length} UOMs processed`);

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

        // 5. Create Consumidor Final Client
        console.log('🏢 Creating default CONSUMIDOR FINAL client...');
        const [consumidorFinal] = await db
            .insert(entities)
            .values({
                tax_id: '9999999999999',
                tax_id_type: 'CONSUMIDOR_FINAL',
                person_type: 'NATURAL',
                business_name: 'CONSUMIDOR FINAL',
                is_client: true,
                is_active: true,
                obligado_contabilidad: false,
            })
            .onConflictDoUpdate({
                target: entities.tax_id,
                set: { business_name: 'CONSUMIDOR FINAL' }
            })
            .returning();
        console.log(`   ✅ Entity created/verified: ${consumidorFinal.business_name}`);

        // 6. Create Default Users
        console.log('👤 Creating default users...');

        const defaultPassword = 'password123';
        const hashedPassword = await Bun.password.hash(defaultPassword);

        const usersToCreate = [
            {
                username: 'superadmin',
                email: 'superadmin@app.com',
                role: 'superadmin',
                entity_id: null // System user
            },
            {
                username: 'admin',
                email: 'admin@app.com',
                role: 'admin',
                entity_id: null // System user
            }
        ];

        for (const userData of usersToCreate) {
            // Check if user exists
            const existingUser = await db.select().from(authUsers).where(sql`${authUsers.email} = ${userData.email}`).limit(1);

            let userId;

            if (existingUser.length === 0) {
                const [newUser] = await db.insert(authUsers).values({
                    username: userData.username,
                    email: userData.email,
                    password_hash: hashedPassword,
                    is_active: true,
                    entity_id: userData.entity_id
                }).returning();
                userId = newUser.id;
                console.log(`  ✅ Created user: ${userData.username}`);
            } else {
                userId = existingUser[0].id;
                console.log(`  ℹ️ User already exists: ${userData.username}`);
            }

            // Assign Role
            const roleId = roleMap.get(userData.role);
            if (roleId) {
                await db
                    .insert(authUserRoles)
                    .values({ user_id: userId, role_id: roleId })
                    .onConflictDoNothing();
                console.log(`   🔗 Assigned role ${userData.role} to ${userData.username}`);
            } else {
                console.warn(`   ⚠️ Role ${userData.role} not found for user ${userData.username}`);
            }
        }

        console.log('\n✅ Seed completed successfully!');

        // Verification
        const permCount = await db.select({ count: sql<number>`count(*)` }).from(authPermissions);
        const roleCount = await db.select({ count: sql<number>`count(*)` }).from(authRoles);
        const userCount = await db.select({ count: sql<number>`count(*)` }).from(authUsers);

        console.log(`\n📊 Summary:`);
        console.log(`   - Total permissions: ${permCount[0].count}`);
        console.log(`   - Total roles: ${roleCount[0].count}`);
        console.log(`   - Total users: ${userCount[0].count}`);


    } catch (error) {
        console.error('❌ Seed failed:', error);
        process.exit(1);
    }

    process.exit(0);
}

seed();
