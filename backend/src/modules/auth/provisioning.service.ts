/**
 * provisioning.service.ts — Reusable functions for provisioning a new company tenant.
 * 
 * Used by:
 *   - auth.service.register() for self-service SaaS registration
 *   - seed.ts for development environment setup
 * 
 * All functions accept a Drizzle transaction (tx) to ensure atomicity.
 */
import type { Tx } from '../../core/db';
import { and, eq, sql } from '@app/schema';
import {
    authRoles, authPermissions, authRolePermissions, authUserRoles,
    authMenuItems, warehouses, warehouseLocations, uom,
    saasTenantSubscriptions,
} from '@app/schema/tables';
import type { MenuItemStatus, RbacModule, SaasPaymentMethodType, SaasPlanId, SaasSubscriptionStatus } from '@app/schema/enums';
import { resolveAllowedModulesForPlan } from '@app/schema/backend';
import { cacheService } from '../../core/cache';

// @ts-ignore — relative path to seeds is valid at runtime
import { PERMISSIONS, ROLES, ROLE_PERMISSIONS, MENU_ITEMS, DERIVED_UOM_DATA } from '../../seeds/seed-data';

/**
 * Seeds all RBAC roles + permissions for a company filtered by its SaaS plan,
 * then assigns the owner to superadmin in a single optimized batch insert.
 */
export async function seedCompanyRBAC(
    tx: Tx,
    companyId: number,
    ownerUserId: string | number,
    planId: SaasPlanId = 'free'
) {
    const ownerUserIdStr = String(ownerUserId);

    // 1. Insert permissions (global master catalog)
    await tx
        .insert(authPermissions)
        .values(PERMISSIONS)
        .onConflictDoUpdate({
            target: authPermissions.slug,
            set: {
                module: sql`excluded.module`,
                action: sql`excluded.action`,
                description: sql`excluded.description`,
            },
        });

    // Upsert returns both inserted and pre-existing roles, making retries complete.
    const roleRows = await tx
        .insert(authRoles)
        .values(ROLES.map((role) => ({ ...role, company_id: companyId })))
        .onConflictDoUpdate({
            target: [authRoles.company_id, authRoles.name],
            set: {
                description: sql`excluded.description`,
                is_system: sql`excluded.is_system`,
                priority: sql`excluded.priority`,
            },
        })
        .returning({ id: authRoles.id, name: authRoles.name });
    const roleMap = new Map(roleRows.map((role) => [role.name, role.id]));

    // 3. Resolve allowed modules for this tenant's plan
    const allowedModules = resolveAllowedModulesForPlan(planId);

    // 4. Batch-assign role permissions in ONE single insert query
    const rolePermValues: { role_id: number; permission_slug: string; company_id: number }[] = [];

    for (const [roleName, checkFn] of Object.entries(ROLE_PERMISSIONS) as [string, (slug: string) => boolean][]) {
        const roleId = roleMap.get(roleName);
        if (!roleId) continue;

        const matchingPerms = (PERMISSIONS as { slug: string; module: RbacModule }[]).filter(
            p => allowedModules.has(p.module) && checkFn(p.slug)
        );

        for (const p of matchingPerms) {
            rolePermValues.push({
                role_id: roleId,
                permission_slug: p.slug,
                company_id: companyId,
            });
        }
    }

    if (rolePermValues.length > 0) {
        await tx
            .insert(authRolePermissions)
            .values(rolePermValues)
            .onConflictDoNothing();
    }

    // 5. Assign owner user to superadmin role
    const superadminRoleId = roleMap.get('superadmin');
    if (!ownerUserIdStr.trim() || !superadminRoleId) {
        throw new Error('Unable to assign tenant owner: user id or superadmin role is missing');
    }
    await tx
        .insert(authUserRoles)
        .values({ user_id: ownerUserIdStr, role_id: superadminRoleId, company_id: companyId })
        .onConflictDoNothing();

    return roleMap;
}

/**
 * Seeds the initial SaaS subscription for a new company tenant.
 */
export async function seedCompanySubscription(
    tx: Tx,
    companyId: number,
    planId: SaasPlanId,
    status: SaasSubscriptionStatus,
    paymentMethod: SaasPaymentMethodType | null,
) {
    await tx
        .insert(saasTenantSubscriptions)
        .values({
            company_id: companyId,
            plan_id: planId,
            status,
            payment_method_type: paymentMethod,
            current_period_start: new Date(),
        })
        .onConflictDoNothing();
}

/**
 * Seeds global master catalog menu items (company_id = null).
 * In our 2-table architecture, tenant customizations are created on demand;
 * tenants inherit the global master catalog with zero overhead during onboarding.
 */
export async function seedCompanyMenus(tx: Tx, companyId: number | null = null) {
    if (companyId !== null) return;

    const parentRows = await tx
        .insert(authMenuItems)
        .values(MENU_ITEMS.map((item) => ({
            key: item.key,
            label: item.label,
            icon: item.icon,
            path: item.path || null,
            path_alias: item.path_alias || null,
            parent_id: null,
            sort_order: item.sort_order,
            permission_prefix: item.permission_prefix || null,
            status: (item.status ?? 'active') as MenuItemStatus,
        })))
        .onConflictDoUpdate({
            target: authMenuItems.key,
            set: {
                label: sql`excluded.label`,
                icon: sql`excluded.icon`,
                path: sql`excluded.path`,
                path_alias: sql`excluded.path_alias`,
                parent_id: sql`excluded.parent_id`,
                sort_order: sql`excluded.sort_order`,
                permission_prefix: sql`excluded.permission_prefix`,
                status: sql`excluded.status`,
            },
        })
        .returning({ id: authMenuItems.id, key: authMenuItems.key });

    const parentMap = new Map(parentRows.map((row) => [row.key, row.id]));
    if (parentMap.size !== MENU_ITEMS.length) throw new Error('Could not resolve all global menu parent IDs');

    const childRows = MENU_ITEMS.flatMap((parent) => (parent.children ?? []).map((child) => {
        const parentId = parentMap.get(parent.key);
        if (!parentId) throw new Error(`Menu parent ${parent.key} was not persisted`);
        return {
            key: child.key,
            label: child.label,
            icon: child.icon,
            path: child.path || null,
            path_alias: child.path_alias || null,
            parent_id: parentId,
            sort_order: child.sort_order,
            permission_prefix: child.permission_prefix || null,
            status: (child.status ?? 'active') as MenuItemStatus,
        };
    }));

    if (childRows.length > 0) {
        await tx.insert(authMenuItems).values(childRows).onConflictDoUpdate({
            target: authMenuItems.key,
            set: {
                label: sql`excluded.label`,
                icon: sql`excluded.icon`,
                path: sql`excluded.path`,
                path_alias: sql`excluded.path_alias`,
                parent_id: sql`excluded.parent_id`,
                sort_order: sql`excluded.sort_order`,
                permission_prefix: sql`excluded.permission_prefix`,
                status: sql`excluded.status`,
            },
        });
    }

    cacheService.invalidate(`menus:${companyId ?? 'global'}`);
    if (companyId) cacheService.invalidate(`aliases:${companyId}`);
}

/**
 * Seeds derived UOMs (non-system, base_factor != 1) for a new company.
 */
export async function seedCompanyUOMs(tx: Tx, companyId: number) {
    if (!DERIVED_UOM_DATA || DERIVED_UOM_DATA.length === 0) return;

    await tx
        .insert(uom)
        .values(DERIVED_UOM_DATA.map((derived) => ({
            code: derived.code,
            name: derived.name,
            uom_group: derived.uom_group,
            base_factor: derived.base_factor,
            company_id: companyId,
            is_system: false,
            is_active: true,
        })))
        .onConflictDoNothing();
}

/**
 * Seeds required system virtual locations (SUPPLIER, CUSTOMER, ADJUSTMENT, PRODUCTION) for a new company.
 */
export async function seedCompanyVirtualLocations(tx: Tx, companyId: number) {
    const virtuals = [
        { name: 'Virtual: Proveedores', type: 'SUPPLIER' as const },
        { name: 'Virtual: Clientes', type: 'CUSTOMER' as const },
        { name: 'Virtual: Ajustes y Mermas', type: 'ADJUSTMENT' as const },
        { name: 'Virtual: Consumo Producción', type: 'PRODUCTION' as const },
    ];

    await tx.insert(warehouseLocations).values(virtuals.map((v) => ({
            company_id: companyId,
            warehouse_id: null,
            parent_id: null,
            name: v.name,
            path: '',
            type: v.type,
            depth: 0,
            is_active: true,
        })))
        .onConflictDoNothing({
            target: [warehouseLocations.company_id, warehouseLocations.name],
            where: sql`${warehouseLocations.warehouse_id} IS NULL`,
        });
}

/**
 * Seeds default physical warehouse (Bodega Principal) and its default internal location (General).
 */
export async function seedCompanyWarehouse(
    tx: Tx,
    companyId: number,
    companyAddress?: string,
    managerEntityId?: string
) {
    // 1. Create default physical warehouse
    const [insertedWarehouse] = await tx
        .insert(warehouses)
        .values({
            company_id: companyId,
            code: 'BOD-001',
            name: 'Bodega Principal',
            address: companyAddress || 'Matriz',
            is_active: true,
            is_mobile: false,
            manager_id: managerEntityId || null,
        })
        .onConflictDoNothing({ target: [warehouses.company_id, warehouses.code] })
        .returning({ id: warehouses.id });

    let warehouseId = insertedWarehouse?.id;
    if (!warehouseId) {
        const [existingWarehouse] = await tx
            .select({ id: warehouses.id })
            .from(warehouses)
            .where(and(eq(warehouses.company_id, companyId), eq(warehouses.code, 'BOD-001')))
            .limit(1);
        warehouseId = existingWarehouse?.id;
    }

    if (!warehouseId) {
        throw new Error(`Could not resolve the default warehouse for company ${companyId}`);
    }

    // The partial unique index makes this safe under retries and concurrent seeds.
    await tx
        .insert(warehouseLocations)
        .values({
            company_id: companyId,
            warehouse_id: warehouseId,
            parent_id: null,
            name: 'General',
            path: 'general',
            type: 'INTERNAL',
            depth: 0,
            is_active: true,
        })
        .onConflictDoNothing({
            target: [warehouseLocations.company_id, warehouseLocations.warehouse_id, warehouseLocations.path],
            where: sql`${warehouseLocations.warehouse_id} IS NOT NULL`,
        });
}
