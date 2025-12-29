-- ============================================
-- RBAC SEED FILE FOR ERP SYSTEM
-- Generated from modules.ts configuration
-- Run: psql -U your_user -d your_database -f src/seeds/rbac_seed.sql
-- ============================================

BEGIN;

-- ============================================
-- 1. INSERT ALL PERMISSIONS
-- Format: module.action (read, add, edit, delete)
-- ============================================

INSERT INTO auth_permissions (slug, description) VALUES
-- Dashboard
('dashboard.read', 'Ver panel de control'),
('dashboard.add', 'Crear elementos en dashboard'),
('dashboard.edit', 'Editar elementos en dashboard'),
('dashboard.delete', 'Eliminar elementos en dashboard'),

-- CRM
('crm.read', 'Ver módulo CRM'),
('crm.add', 'Crear en CRM'),
('crm.edit', 'Editar en CRM'),
('crm.delete', 'Eliminar en CRM'),

-- Clients
('clients.read', 'Ver clientes'),
('clients.add', 'Crear clientes'),
('clients.edit', 'Editar clientes'),
('clients.delete', 'Eliminar clientes'),

-- Technical Visits
('visits.read', 'Ver visitas técnicas'),
('visits.add', 'Crear visitas técnicas'),
('visits.edit', 'Editar visitas técnicas'),
('visits.delete', 'Eliminar visitas técnicas'),

-- Budgets/Quotations
('budgets.read', 'Ver presupuestos'),
('budgets.add', 'Crear presupuestos'),
('budgets.edit', 'Editar presupuestos'),
('budgets.delete', 'Eliminar presupuestos'),

-- Invoices
('invoices.read', 'Ver facturas'),
('invoices.add', 'Crear facturas'),
('invoices.edit', 'Editar facturas'),
('invoices.delete', 'Anular facturas'),

-- Operations
('operations.read', 'Ver operaciones'),
('operations.add', 'Crear operaciones'),
('operations.edit', 'Editar operaciones'),
('operations.delete', 'Eliminar operaciones'),

-- Work Orders
('work_orders.read', 'Ver órdenes de trabajo'),
('work_orders.add', 'Crear órdenes de trabajo'),
('work_orders.edit', 'Editar órdenes de trabajo'),
('work_orders.delete', 'Eliminar órdenes de trabajo'),

-- Schedule
('schedule.read', 'Ver cronograma'),
('schedule.add', 'Crear eventos en cronograma'),
('schedule.edit', 'Editar eventos en cronograma'),
('schedule.delete', 'Eliminar eventos en cronograma'),

-- Projects
('projects.read', 'Ver historial de proyectos'),
('projects.add', 'Crear proyectos'),
('projects.edit', 'Editar proyectos'),
('projects.delete', 'Eliminar proyectos'),

-- Production
('production.read', 'Ver producción'),
('production.add', 'Crear producción'),
('production.edit', 'Editar producción'),
('production.delete', 'Eliminar producción'),

-- Planning
('planning.read', 'Ver planificación'),
('planning.add', 'Crear planificación'),
('planning.edit', 'Editar planificación'),
('planning.delete', 'Eliminar planificación'),

-- Materials
('materials.read', 'Ver solicitudes de materiales'),
('materials.add', 'Crear solicitudes de materiales'),
('materials.edit', 'Editar solicitudes de materiales'),
('materials.delete', 'Eliminar solicitudes de materiales'),

-- Quality Control
('quality.read', 'Ver control de calidad'),
('quality.add', 'Crear control de calidad'),
('quality.edit', 'Editar control de calidad'),
('quality.delete', 'Eliminar control de calidad'),

-- Inventory
('inventory.read', 'Ver inventario'),
('inventory.add', 'Crear inventario'),
('inventory.edit', 'Editar inventario'),
('inventory.delete', 'Eliminar inventario'),

-- Products
('products.read', 'Ver productos'),
('products.add', 'Crear productos'),
('products.edit', 'Editar productos'),
('products.delete', 'Eliminar productos'),

-- Movements
('movements.read', 'Ver movimientos'),
('movements.add', 'Crear movimientos'),
('movements.edit', 'Editar movimientos'),
('movements.delete', 'Eliminar movimientos'),

-- Orders
('orders.read', 'Ver pedidos de material'),
('orders.add', 'Crear pedidos de material'),
('orders.edit', 'Editar pedidos de material'),
('orders.delete', 'Eliminar pedidos de material'),

-- Stock Taking
('stock_taking.read', 'Ver toma física'),
('stock_taking.add', 'Crear toma física'),
('stock_taking.edit', 'Editar toma física'),
('stock_taking.delete', 'Eliminar toma física'),

-- Remission Guides
('remission_guides.read', 'Ver guías de remisión'),
('remission_guides.add', 'Crear guías de remisión'),
('remission_guides.edit', 'Editar guías de remisión'),
('remission_guides.delete', 'Eliminar guías de remisión'),

-- Purchases
('purchases.read', 'Ver compras'),
('purchases.add', 'Crear compras'),
('purchases.edit', 'Editar compras'),
('purchases.delete', 'Eliminar compras'),

-- Suppliers
('suppliers.read', 'Ver proveedores'),
('suppliers.add', 'Crear proveedores'),
('suppliers.edit', 'Editar proveedores'),
('suppliers.delete', 'Eliminar proveedores'),

-- Purchase Quotes
('purchase_quotes.read', 'Ver cotizaciones de compra'),
('purchase_quotes.add', 'Crear cotizaciones de compra'),
('purchase_quotes.edit', 'Editar cotizaciones de compra'),
('purchase_quotes.delete', 'Eliminar cotizaciones de compra'),

-- Purchase Orders
('purchase_orders.read', 'Ver órdenes de compra'),
('purchase_orders.add', 'Crear órdenes de compra'),
('purchase_orders.edit', 'Editar órdenes de compra'),
('purchase_orders.delete', 'Eliminar órdenes de compra'),

-- Purchase Invoices
('purchase_invoices.read', 'Ver recepción de facturas'),
('purchase_invoices.add', 'Registrar facturas de compra'),
('purchase_invoices.edit', 'Editar facturas de compra'),
('purchase_invoices.delete', 'Eliminar facturas de compra'),

-- Finance
('finance.read', 'Ver finanzas'),
('finance.add', 'Crear en finanzas'),
('finance.edit', 'Editar en finanzas'),
('finance.delete', 'Eliminar en finanzas'),

-- Documents
('documents.read', 'Ver documentos electrónicos'),
('documents.add', 'Crear documentos electrónicos'),
('documents.edit', 'Editar documentos electrónicos'),
('documents.delete', 'Eliminar documentos electrónicos'),

-- Retentions
('retentions.read', 'Ver retenciones'),
('retentions.add', 'Crear retenciones'),
('retentions.edit', 'Editar retenciones'),
('retentions.delete', 'Eliminar retenciones'),

-- Accounts Receivable
('receivable.read', 'Ver cuentas por cobrar'),
('receivable.add', 'Crear cuentas por cobrar'),
('receivable.edit', 'Editar cuentas por cobrar'),
('receivable.delete', 'Eliminar cuentas por cobrar'),

-- Accounts Payable
('payable.read', 'Ver cuentas por pagar'),
('payable.add', 'Crear cuentas por pagar'),
('payable.edit', 'Editar cuentas por pagar'),
('payable.delete', 'Eliminar cuentas por pagar'),

-- Petty Cash
('petty_cash.read', 'Ver caja chica'),
('petty_cash.add', 'Crear movimientos caja chica'),
('petty_cash.edit', 'Editar movimientos caja chica'),
('petty_cash.delete', 'Eliminar movimientos caja chica'),

-- HR
('hr.read', 'Ver talento humano'),
('hr.add', 'Crear en talento humano'),
('hr.edit', 'Editar en talento humano'),
('hr.delete', 'Eliminar en talento humano'),

-- Payroll
('payroll.read', 'Ver nómina'),
('payroll.add', 'Crear nómina'),
('payroll.edit', 'Editar nómina'),
('payroll.delete', 'Eliminar nómina'),

-- Schedules
('schedules.read', 'Ver control de horarios'),
('schedules.add', 'Crear horarios'),
('schedules.edit', 'Editar horarios'),
('schedules.delete', 'Eliminar horarios'),

-- Hours Report
('hours.read', 'Ver reporte de horas'),
('hours.add', 'Crear reporte de horas'),
('hours.edit', 'Editar reporte de horas'),
('hours.delete', 'Eliminar reporte de horas'),

-- System
('system.read', 'Ver sistema'),
('system.add', 'Crear en sistema'),
('system.edit', 'Editar en sistema'),
('system.delete', 'Eliminar en sistema'),

-- Config
('config.read', 'Ver configuración'),
('config.add', 'Crear configuración'),
('config.edit', 'Editar configuración'),
('config.delete', 'Eliminar configuración'),

-- Users
('users.read', 'Ver usuarios'),
('users.add', 'Crear usuarios'),
('users.edit', 'Editar usuarios'),
('users.delete', 'Eliminar usuarios'),

-- Audit
('audit.read', 'Ver auditoría'),
('audit.add', 'Crear auditoría'),
('audit.edit', 'Editar auditoría'),
('audit.delete', 'Eliminar auditoría'),

-- Roles Management
('roles.read', 'Ver roles'),
('roles.add', 'Crear roles'),
('roles.edit', 'Editar roles'),
('roles.delete', 'Eliminar roles'),

-- Permissions Management
('permissions.read', 'Ver permisos'),
('permissions.add', 'Asignar permisos'),
('permissions.edit', 'Modificar asignación de permisos'),
('permissions.delete', 'Revocar permisos')

ON CONFLICT (slug) DO NOTHING;

-- ============================================
-- 2. CREATE ROLES
-- ============================================

INSERT INTO auth_roles (name, description) VALUES
('superadmin', 'Super Administrador con acceso total al sistema'),
('admin', 'Administrador del sistema'),
('gerente', 'Gerente con acceso a reportes y aprobaciones'),
('ventas', 'Equipo de ventas y CRM'),
('produccion', 'Equipo de producción y manufactura'),
('inventario', 'Gestión de inventario y almacén'),
('contabilidad', 'Equipo de finanzas y contabilidad'),
('rrhh', 'Recursos Humanos')
ON CONFLICT (name) DO NOTHING;

-- ============================================
-- 3. ASSIGN ALL PERMISSIONS TO SUPERADMIN
-- ============================================

INSERT INTO auth_role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM auth_roles r
CROSS JOIN auth_permissions p
WHERE r.name = 'superadmin'
ON CONFLICT DO NOTHING;

-- ============================================
-- 4. ASSIGN SUPERADMIN ROLE TO USER ID 1
-- ============================================

INSERT INTO auth_user_roles (user_id, role_id)
SELECT 1, r.id
FROM auth_roles r
WHERE r.name = 'superadmin'
ON CONFLICT DO NOTHING;

-- ============================================
-- 5. SETUP OTHER ROLES WITH COMMON PERMISSIONS
-- ============================================

-- Admin gets most permissions except system delete
INSERT INTO auth_role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM auth_roles r
CROSS JOIN auth_permissions p
WHERE r.name = 'admin'
  AND p.slug NOT LIKE '%.delete'
  AND p.slug NOT IN ('system.delete', 'config.delete', 'users.delete', 'roles.delete', 'permissions.delete')
ON CONFLICT DO NOTHING;

-- Gerente role
INSERT INTO auth_role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM auth_roles r
CROSS JOIN auth_permissions p
WHERE r.name = 'gerente'
  AND (p.slug LIKE 'dashboard.%' 
       OR p.slug LIKE 'crm.read%'
       OR p.slug LIKE 'clients.%'
       OR p.slug LIKE 'invoices.read%'
       OR p.slug LIKE 'finance.read%'
       OR p.slug LIKE 'hr.read%'
       OR p.slug LIKE 'audit.read%')
ON CONFLICT DO NOTHING;

-- Ventas role
INSERT INTO auth_role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM auth_roles r
CROSS JOIN auth_permissions p
WHERE r.name = 'ventas'
  AND (p.slug LIKE 'dashboard.read%'
       OR p.slug LIKE 'crm.%'
       OR p.slug LIKE 'clients.%'
       OR p.slug LIKE 'visits.%'
       OR p.slug LIKE 'budgets.%'
       OR p.slug LIKE 'invoices.%')
ON CONFLICT DO NOTHING;

-- Produccion role
INSERT INTO auth_role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM auth_roles r
CROSS JOIN auth_permissions p
WHERE r.name = 'produccion'
  AND (p.slug LIKE 'dashboard.read%'
       OR p.slug LIKE 'production.%'
       OR p.slug LIKE 'planning.%'
       OR p.slug LIKE 'work_orders.%'
       OR p.slug LIKE 'materials.%'
       OR p.slug LIKE 'quality.%')
ON CONFLICT DO NOTHING;

-- Inventario role
INSERT INTO auth_role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM auth_roles r
CROSS JOIN auth_permissions p
WHERE r.name = 'inventario'
  AND (p.slug LIKE 'dashboard.read%'
       OR p.slug LIKE 'inventory.%'
       OR p.slug LIKE 'products.%'
       OR p.slug LIKE 'movements.%'
       OR p.slug LIKE 'orders.%'
       OR p.slug LIKE 'stock_taking.%'
       OR p.slug LIKE 'remission_guides.%')
ON CONFLICT DO NOTHING;

-- Contabilidad role
INSERT INTO auth_role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM auth_roles r
CROSS JOIN auth_permissions p
WHERE r.name = 'contabilidad'
  AND (p.slug LIKE 'dashboard.read%'
       OR p.slug LIKE 'finance.%'
       OR p.slug LIKE 'invoices.%'
       OR p.slug LIKE 'documents.%'
       OR p.slug LIKE 'retentions.%'
       OR p.slug LIKE 'receivable.%'
       OR p.slug LIKE 'payable.%'
       OR p.slug LIKE 'petty_cash.%'
       OR p.slug LIKE 'purchases.%')
ON CONFLICT DO NOTHING;

-- RRHH role
INSERT INTO auth_role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM auth_roles r
CROSS JOIN auth_permissions p
WHERE r.name = 'rrhh'
  AND (p.slug LIKE 'dashboard.read%'
       OR p.slug LIKE 'hr.%'
       OR p.slug LIKE 'payroll.%'
       OR p.slug LIKE 'schedules.%'
       OR p.slug LIKE 'hours.%')
ON CONFLICT DO NOTHING;

COMMIT;

-- ============================================
-- VERIFICATION QUERIES (Run manually)
-- ============================================
-- SELECT COUNT(*) as total_permissions FROM auth_permissions;
-- SELECT r.name, COUNT(rp.permission_id) as permisos FROM auth_roles r LEFT JOIN auth_role_permissions rp ON r.id = rp.role_id GROUP BY r.name;
-- SELECT u.username, STRING_AGG(r.name, ', ') as roles FROM auth_users u LEFT JOIN auth_user_roles ur ON u.id = ur.user_id LEFT JOIN auth_roles r ON ur.role_id = r.id GROUP BY u.id, u.username;
