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
import {
    authRoles, authPermissions, authRolePermissions, authUserRoles,
    authMenuItems, warehouses, warehouseLocations, uom,
} from '@app/schema/tables';
import type { MenuItemStatus } from '@app/schema/enums';

// @ts-ignore — relative path to seeds is valid at runtime
import { PERMISSIONS, ROLES, ROLE_PERMISSIONS, MENU_ITEMS, DERIVED_UOM_DATA } from '../../seeds/seed-data';

/**
 * Seeds all RBAC roles + permissions for a company, then assigns the owner to superadmin.
 */
export async function seedCompanyRBAC(tx: Tx, companyId: number, ownerUserId: string | number) {
    const ownerUserIdStr = String(ownerUserId);
    // 1. Insert permissions (global)
    await tx
        .insert(authPermissions)
        .values(PERMISSIONS)
        .onConflictDoNothing({ target: authPermissions.slug });

    // 2. Insert roles scoped to this company
    const roleMap = new Map<string, number>();
    for (const role of ROLES) {
        const [result] = await tx
            .insert(authRoles)
            .values({ ...role, company_id: companyId })
            .onConflictDoNothing()
            .returning({ id: authRoles.id, name: authRoles.name });
        if (result) roleMap.set(result.name, result.id);
    }

    // 3. Get all permission IDs for mapping
    const allPermissions = await tx.select().from(authPermissions);
    const permMap = new Map(allPermissions.map(p => [p.slug, p.id]));

    // 4. Assign permissions to roles using filter functions
    for (const [roleName, checkFn] of Object.entries(ROLE_PERMISSIONS) as [string, (slug: string) => boolean][]) {
        const roleId = roleMap.get(roleName);
        if (!roleId) continue;

        const permIds = PERMISSIONS
            .filter((p: { slug: string }) => checkFn(p.slug))
            .map((p: { slug: string }) => permMap.get(p.slug))
            .filter((id: number | undefined): id is number => id !== undefined);

        if (permIds.length > 0) {
            await tx
                .insert(authRolePermissions)
                .values(permIds.map(permissionId => ({ role_id: roleId, permission_id: permissionId, company_id: companyId })))
                .onConflictDoNothing();
        }
    }

    // 5. Assign owner user to superadmin role
    const superadminRoleId = roleMap.get('superadmin');
    if (superadminRoleId) {
        await tx
            .insert(authUserRoles)
            .values({ user_id: ownerUserIdStr, role_id: superadminRoleId, company_id: companyId })
            .onConflictDoNothing();
    }

    return roleMap;
}

/**
 * Seeds all menu items for a company (parents + children).
 */
export async function seedCompanyMenus(tx: Tx) {
    const parentMap = new Map<string, number>();

    // Insert parent items
    for (const item of MENU_ITEMS) {
        const itemStatus: MenuItemStatus = item.status ?? 'active';
        const [result] = await tx
            .insert(authMenuItems)
            .values({
                key: item.key,
                label: item.label,
                icon: item.icon,
                path: item.path || null,
                parent_id: null,
                sort_order: item.sort_order,
                permission_prefix: item.permission_prefix || null,
                status: itemStatus,
            })
            .onConflictDoUpdate({
                target: authMenuItems.key,
                set: {
                    label: item.label,
                    icon: item.icon,
                    path: item.path || null,
                    sort_order: item.sort_order,
                    permission_prefix: item.permission_prefix || null,
                    status: itemStatus,
                }
            })
            .returning({ id: authMenuItems.id });

        parentMap.set(item.key, result.id);
    }

    // Insert children
    for (const parent of MENU_ITEMS) {
        if (!parent.children) continue;
        const parentId = parentMap.get(parent.key);
        if (!parentId) continue;

        for (const child of parent.children) {
            const childStatus: MenuItemStatus = child.status ?? 'active';
            await tx
                .insert(authMenuItems)
                .values({
                    key: child.key,
                    label: child.label,
                    icon: child.icon,
                    path: child.path || null,
                    parent_id: parentId,
                    sort_order: child.sort_order,
                    permission_prefix: child.permission_prefix || null,
                    status: childStatus,
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
                        status: childStatus,
                    }
                });
        }
    }
}

/**
 * Seeds derived UOMs (non-system, base_factor != 1) for a new company.
 */
export async function seedCompanyUOMs(tx: Tx, companyId: number) {
    if (!DERIVED_UOM_DATA || DERIVED_UOM_DATA.length === 0) return;
    
    for (const derived of DERIVED_UOM_DATA) {
        await tx
            .insert(uom)
            .values({
                code: derived.code,
                name: derived.name,
                uom_group: derived.uom_group as any,
                base_factor: derived.base_factor,
                company_id: companyId,
                is_system: false,
                is_active: true,
            })
            .onConflictDoNothing();
    }
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

    for (const v of virtuals) {
        await tx.insert(warehouseLocations).values({
            company_id: companyId,
            warehouse_id: null,
            parent_id: null,
            name: v.name,
            path: '',
            type: v.type,
            depth: 0,
            is_active: true,
        }).onConflictDoNothing();
    }
}

/**
 * Seeds default physical warehouse (Bodega Principal) and its default internal location (General).
 */
export async function seedCompanyWarehouse(
    tx: Tx,
    companyId: number,
    companyAddress?: string,
    managerEntityId?: number
) {
    // 1. Create default physical warehouse
    const [mainWarehouse] = await tx
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
        .onConflictDoNothing()
        .returning({ id: warehouses.id });

    const warehouseId = mainWarehouse?.id;
    if (warehouseId) {
        // 2. Create default root internal location
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
            .onConflictDoNothing();
    }
}
