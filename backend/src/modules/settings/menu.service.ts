import { adminDb } from '../../core/db';
import { authMenuItems, tenantMenuCustomizations } from '@app/schema/tables';
import { eq, asc, sql, isNull, and, isNotNull } from '@app/schema';
import type { MenuItemStatus } from '@app/schema/enums';
import { getUserPermissions, getUserRoles } from '../rbac/rbac.permission.service';
import { cacheService } from '../../core/cache';
import { DomainError, NotFoundError } from '../../core/errors';
import { seedCompanyMenus } from '../auth/provisioning.service';
import { RealtimeEvents } from '@app/schema/realtime-events';
import { broadcastToTenant } from '../../core/sse/events';

// Keep backward-compatible interface
export interface ModuleConfig {
    key: string;
    label: string;
    icon?: string;
    path?: string;
    pathAlias?: string;
    permission?: string;
    status?: MenuItemStatus;
    children?: ModuleConfig[];
}

export interface DbMenuItem {
    id: number;
    company_id: number | null;
    key: string;
    label: string;
    icon: string | null;
    path: string | null;
    path_alias: string | null;
    parent_id: number | null;
    sort_order: number | null;
    permission_prefix: string | null;
    status: MenuItemStatus | null;
}

const RESERVED_ALIASES = new Set([
    '/api',
    '/login',
    '/register',
    '/verify-email',
    '/reset-password',
    '/forgot-password',
    '/auth',
    '/settings',
]);

/**
 * Invalidate Redis caches for menus and route aliases and broadcast SSE event
 */
async function invalidateMenuCaches(companyId?: number | null) {
    await cacheService.invalidate('menus:*');
    await cacheService.invalidate('aliases:*');
    if (companyId) {
        await cacheService.del(`menus:${companyId}`, `menus:${companyId}:global`, `aliases:${companyId}`);
        broadcastToTenant(companyId, RealtimeEvents.MENU.UPDATED, { companyId }, RealtimeEvents.ROOMS.MENU).catch((err) => {
            console.error('Failed to broadcast MENU.UPDATED event:', err);
        });
    }
}

/**
 * Get menu tree for a specific user, filtered by their permissions.
 * Queries tenant-specific rows (company_id = N), falls back to global template (company_id IS NULL).
 */
export async function getTenantMenuItems(companyId?: number | null): Promise<DbMenuItem[]> {
    if (companyId) {
        const rows = await adminDb
            .select({
                id: authMenuItems.id,
                company_id: sql<number | null>`${companyId}`,
                key: authMenuItems.key,
                label: sql<string>`COALESCE(${tenantMenuCustomizations.label}, ${authMenuItems.label})`,
                icon: sql<string | null>`COALESCE(${tenantMenuCustomizations.icon}, ${authMenuItems.icon})`,
                path: authMenuItems.path,
                path_alias: sql<string | null>`COALESCE(${tenantMenuCustomizations.path_alias}, ${authMenuItems.path_alias})`,
                parent_id: sql<number | null>`COALESCE(${tenantMenuCustomizations.parent_id}, ${authMenuItems.parent_id})`,
                sort_order: sql<number | null>`COALESCE(${tenantMenuCustomizations.sort_order}, ${authMenuItems.sort_order})`,
                permission_prefix: authMenuItems.permission_prefix,
                status: authMenuItems.status,
            })
            .from(authMenuItems)
            .leftJoin(
                tenantMenuCustomizations,
                and(
                    eq(tenantMenuCustomizations.menu_item_id, authMenuItems.id),
                    eq(tenantMenuCustomizations.company_id, companyId)
                )
            )
            .where(isNull(authMenuItems.company_id))
            .orderBy(
                asc(sql`COALESCE(${tenantMenuCustomizations.parent_id}, ${authMenuItems.parent_id})`),
                asc(sql`COALESCE(${tenantMenuCustomizations.sort_order}, ${authMenuItems.sort_order})`)
            );

        return rows as DbMenuItem[];
    }

    // Global template items
    return adminDb
        .select()
        .from(authMenuItems)
        .where(isNull(authMenuItems.company_id))
        .orderBy(asc(authMenuItems.parent_id), asc(authMenuItems.sort_order)) as Promise<DbMenuItem[]>;
}

/**
 * Get menu tree for a specific user, filtered by their permissions.
 * Integrates tenant customizations over global system catalog.
 */
export async function getMenuForUser(userId: string | number, companyId?: number | null): Promise<ModuleConfig[]> {
    const [roles, permissions, allMenus] = await Promise.all([
        getUserRoles(userId, companyId),
        getUserPermissions(userId, companyId),
        cacheService.getOrSet(`menus:${companyId ?? 'global'}`, async () => {
            return getTenantMenuItems(companyId);
        }, 86400),
    ]);

    const isAdmin = roles.includes('superadmin');
    if (isAdmin) return buildMenuTree(allMenus as DbMenuItem[]);

    return buildMenuTree(filterByPermissions(allMenus as DbMenuItem[], permissions));
}

/**
 * Get full menu tree for admin panel (no permission filtering)
 */
export async function getFullMenuTree(companyId?: number | null): Promise<ModuleConfig[]> {
    const cacheKey = `menus:all:${companyId ?? 'global'}`;
    const allMenus = await cacheService.getOrSet(cacheKey, async () => {
        return getTenantMenuItems(companyId);
    }, 86400);

    return buildMenuTree(allMenus as DbMenuItem[]);
}

/**
 * Backward compatibility alias for getAllMenuItems
 */
export async function getAllMenuItems(companyId?: number | null) {
    return getTenantMenuItems(companyId);
}

/**
 * Update a tenant-scoped menu item (label, path_alias, icon, sort_order, status)
 */
export async function updateTenantMenuItem(
    id: number,
    companyId: number | null | undefined,
    data: {
        label?: string;
        path_alias?: string | null;
        icon?: string | null;
        sort_order?: number;
        parent_id?: number | null;
        status?: MenuItemStatus;
    }
) {
    // Validate path_alias if provided
    let cleanAlias: string | null | undefined = undefined;
    if (data.path_alias !== undefined) {
        if (data.path_alias === null || data.path_alias.trim() === '') {
            cleanAlias = null;
        } else {
            let alias = data.path_alias.trim();
            if (!alias.startsWith('/')) {
                alias = `/${alias}`;
            }
            if (alias.length > 1 && alias.endsWith('/')) {
                alias = alias.slice(0, -1);
            }
            const lower = alias.toLowerCase();
            if (RESERVED_ALIASES.has(lower)) {
                throw new DomainError(`El alias "${alias}" es una ruta reservada del sistema y no puede ser utilizada.`, 400, { code: 'VALIDATION_ERROR' });
            }
            cleanAlias = alias;
        }
    }

    // Handle tenant-scoped update (UPSERT in tenantMenuCustomizations)
    if (companyId) {
        // Verify master item exists
        const masterItem = await adminDb
            .select()
            .from(authMenuItems)
            .where(eq(authMenuItems.id, id))
            .limit(1);

        if (masterItem.length === 0) {
            throw new NotFoundError('Elemento de menú no encontrado en el catálogo maestro');
        }

        const cleanLabel = data.label !== undefined ? data.label.trim() : null;

        await adminDb
            .insert(tenantMenuCustomizations)
            .values({
                company_id: companyId,
                menu_item_id: id,
                label: cleanLabel,
                icon: data.icon !== undefined ? data.icon : null,
                path_alias: cleanAlias !== undefined ? cleanAlias : null,
                sort_order: data.sort_order !== undefined ? data.sort_order : null,
                parent_id: data.parent_id !== undefined ? data.parent_id : null,
            })
            .onConflictDoUpdate({
                target: [tenantMenuCustomizations.company_id, tenantMenuCustomizations.menu_item_id],
                set: {
                    ...(data.label !== undefined ? { label: cleanLabel } : {}),
                    ...(cleanAlias !== undefined ? { path_alias: cleanAlias } : {}),
                    ...(data.icon !== undefined ? { icon: data.icon } : {}),
                    ...(data.sort_order !== undefined ? { sort_order: data.sort_order } : {}),
                    ...(data.parent_id !== undefined ? { parent_id: data.parent_id } : {}),
                    updatedAt: new Date(),
                },
            });

        await invalidateMenuCaches(companyId);
        const allItems = await getTenantMenuItems(companyId);
        return allItems.filter(m => m.id === id);
    }

    // Superadmin editing global template
    const globalPayload: Record<string, any> = {};
    if (data.label !== undefined) globalPayload.label = data.label.trim();
    if (cleanAlias !== undefined) globalPayload.path_alias = cleanAlias;
    if (data.icon !== undefined) globalPayload.icon = data.icon;
    if (data.sort_order !== undefined) globalPayload.sort_order = data.sort_order;
    if (data.parent_id !== undefined) globalPayload.parent_id = data.parent_id;
    if (data.status !== undefined) globalPayload.status = data.status;

    const result = await adminDb
        .update(authMenuItems)
        .set(globalPayload)
        .where(and(eq(authMenuItems.id, id), isNull(authMenuItems.company_id)))
        .returning();

    await invalidateMenuCaches(null);
    return result as DbMenuItem[];
}

/**
 * Backward compatibility alias
 */
export async function updateMenuItem(
    id: number,
    data: { label?: string; path_alias?: string | null; icon?: string | null; sort_order?: number; parent_id?: number | null; status?: MenuItemStatus },
    companyId?: number | null
) {
    return updateTenantMenuItem(id, companyId, data);
}

/**
 * Reorder multiple menu items for a tenant (and optionally reparent)
 */
export async function reorderTenantMenuItems(
    companyId: number | null | undefined,
    items: { id: number; sort_order: number; parent_id?: number | null }[]
) {
    if (items.length === 0) return [];

    if (companyId) {
        for (const item of items) {
            await adminDb
                .insert(tenantMenuCustomizations)
                .values({
                    company_id: companyId,
                    menu_item_id: item.id,
                    sort_order: item.sort_order,
                    parent_id: item.parent_id ?? null,
                })
                .onConflictDoUpdate({
                    target: [tenantMenuCustomizations.company_id, tenantMenuCustomizations.menu_item_id],
                    set: {
                        sort_order: item.sort_order,
                        ...(item.parent_id !== undefined ? { parent_id: item.parent_id } : {}),
                        updatedAt: new Date(),
                    },
                });
        }
    } else {
        const hasParentId = items.some(i => i.parent_id !== undefined);
        const sortCases = items.map(i => sql`WHEN ${i.id} THEN ${i.sort_order}`);
        const parentCases = hasParentId
            ? items.map(i => i.parent_id !== undefined ? sql`WHEN ${i.id} THEN ${i.parent_id}` : sql`WHEN ${i.id} THEN parent_id`)
            : [];
        const ids = items.map(i => i.id);

        await adminDb.execute(sql`
            UPDATE auth_menu_items SET
                sort_order = CASE id
                    ${sql.join(sortCases, sql` `)}
                END
                ${hasParentId ? sql`, parent_id = CASE id ${sql.join(parentCases, sql` `)} END` : sql``}
            WHERE id IN (${sql.join(ids.map(id => sql`${id}`), sql`, `)})
              AND company_id IS NULL
        `);
    }

    await invalidateMenuCaches(companyId);
    return items;
}

/**
 * Backward compatibility alias
 */
export async function reorderMenuItems(items: { id: number; sort_order: number; parent_id?: number | null }[], companyId?: number | null) {
    return reorderTenantMenuItems(companyId, items);
}

/**
 * Reset tenant menu back to system default template (atomic DELETE)
 */
export async function resetTenantMenuToDefault(companyId: number) {
    await adminDb
        .delete(tenantMenuCustomizations)
        .where(eq(tenantMenuCustomizations.company_id, companyId));

    await invalidateMenuCaches(companyId);
    return { success: true };
}

/**
 * Filter menus based on user permissions using permission_prefix.
 * User must explicitly have the specific {prefix}.read permission to see a leaf menu,
 * and we must include all parent menus of accessible children to preserve the tree structure.
 * Items with status === 'development' are preserved so all users see locked features.
 */
function filterByPermissions(menus: DbMenuItem[], permissions: string[]): DbMenuItem[] {
    const permissionSet = new Set(permissions);
    const accessibleMenuIds = new Set<number>();

    // Step 1: Identify explicitly accessible menus
    for (const menu of menus) {
        // Items in development are visible in the UI with a lock icon for all authenticated users
        if (menu.status === 'development') {
            accessibleMenuIds.add(menu.id);
        } else if (!menu.permission_prefix) {
            // Leaf menus without permission prefixes are accessible if they have a path
            if (menu.path) {
                accessibleMenuIds.add(menu.id);
            }
        } else {
            // Strict .read check for explicit access
            if (permissionSet.has(`${menu.permission_prefix}.read`)) {
                accessibleMenuIds.add(menu.id);
            }
        }
    }

    // Step 2: Ensure all ancestors (parents) of accessible menus are also included
    const menuMap = new Map(menus.map(m => [m.id, m]));
    const finalMenuIds = new Set<number>(accessibleMenuIds);

    for (const id of accessibleMenuIds) {
        let currentParentId = menuMap.get(id)?.parent_id;
        while (currentParentId) {
            finalMenuIds.add(currentParentId);
            currentParentId = menuMap.get(currentParentId)?.parent_id;
        }
    }

    // Step 3: Filter the original list
    const result = menus.filter(menu => finalMenuIds.has(menu.id));

    // Step 4: Final cleanup — remove any parent menus that ended up with no accessible children and have no path
    return result.filter(menu => {
        if (menu.path) return true;
        // Check if this menu acts as a parent to any other menu in the final result
        return result.some(m => m.parent_id === menu.id);
    });
}

/**
 * Build hierarchical tree from flat menu list
 */
function buildMenuTree(menus: DbMenuItem[]): ModuleConfig[] {
    const menuMap = new Map<number, ModuleConfig & { _id: number }>();

    // First pass: create all nodes
    for (const menu of menus) {
        menuMap.set(menu.id, {
            _id: menu.id,
            key: menu.key,
            label: menu.label,
            icon: menu.icon ?? undefined,
            path: menu.path ?? undefined,
            pathAlias: menu.path_alias ?? undefined,
            permission: menu.permission_prefix ? `${menu.permission_prefix}.read` : undefined,
            status: menu.status ?? undefined,
            children: [],
        });
    }

    // Second pass: build tree
    const roots: ModuleConfig[] = [];

    for (const menu of menus) {
        const node = menuMap.get(menu.id)!;

        if (menu.parent_id === null) {
            roots.push(node);
        } else {
            const parent = menuMap.get(menu.parent_id);
            if (parent) {
                parent.children = parent.children || [];
                parent.children.push(node);
            }
        }
    }

    // Clean up: remove _id and empty children arrays
    const cleanNode = (node: ModuleConfig & { _id?: number }): ModuleConfig => {
        const { _id, ...rest } = node;
        if (rest.children && rest.children.length === 0) {
            delete rest.children;
        } else if (rest.children) {
            rest.children = rest.children.map(cleanNode);
        }
        return rest;
    };

    return roots.map(cleanNode);
}

/**
 * Returns the route alias map for a tenant (alias → real path).
 * Used by SPA Renderer to inject pre-boot script for 100% alias mitigation.
 */
export async function getRouteAliases(companyId: number): Promise<Record<string, string>> {
    return cacheService.getOrSet(`aliases:${companyId}`, async () => {
        const items = await adminDb
            .select({
                path: authMenuItems.path,
                path_alias: sql<string | null>`COALESCE(${tenantMenuCustomizations.path_alias}, ${authMenuItems.path_alias})`,
            })
            .from(authMenuItems)
            .leftJoin(
                tenantMenuCustomizations,
                and(
                    eq(tenantMenuCustomizations.menu_item_id, authMenuItems.id),
                    eq(tenantMenuCustomizations.company_id, companyId)
                )
            )
            .where(and(
                isNull(authMenuItems.company_id),
                isNotNull(authMenuItems.path)
            ));

        const aliasMap: Record<string, string> = {};
        for (const m of items) {
            if (m.path && m.path_alias && m.path !== m.path_alias) {
                aliasMap[m.path_alias] = m.path;
            }
        }

        return aliasMap;
    }, 86400);
}
