import { db } from '../db';
import { authMenuItems } from '@app/schema/tables';
import { eq, asc, sql } from '@app/schema';
import { getUserPermissions, getUserRoles } from './rbac.service';
import { cacheService } from './cache.service';

// Keep backward-compatible interface
export interface ModuleConfig {
    key: string;
    label: string;
    icon?: string;
    path?: string;
    permission?: string;
    children?: ModuleConfig[];
}

interface DbMenuItem {
    id: number;
    key: string;
    label: string;
    icon: string | null;
    path: string | null;
    parent_id: number | null;
    sort_order: number | null;
    permission_prefix: string | null;
    is_active: boolean | null;
}

/**
 * Get menu tree for a specific user, filtered by their permissions
 */
export async function getMenuForUser(userId: number): Promise<ModuleConfig[]> {
    // Parallel: Redis + DB at the same time — eliminates serial waterfall
    const [roles, permissions, allMenus] = await Promise.all([
        getUserRoles(userId),
        getUserPermissions(userId),
        cacheService.getOrSet('menus:all', async () => {
            return db.select()
                .from(authMenuItems)
                .where(eq(authMenuItems.is_active, true))
                .orderBy(asc(authMenuItems.sort_order));
        }, 86400),
    ]);

    const isAdmin = roles.includes('superadmin');
    if (isAdmin) return buildMenuTree(allMenus);

    return buildMenuTree(filterByPermissions(allMenus, permissions));
}

/**
 * Get full menu tree for admin panel (no permission filtering)
 */
export async function getFullMenuTree(): Promise<ModuleConfig[]> {
    const allMenus = await cacheService.getOrSet('menus:all', async () => {
        return db.select()
            .from(authMenuItems)
            .where(eq(authMenuItems.is_active, true))
            .orderBy(asc(authMenuItems.sort_order));
    }, 86400);

    return buildMenuTree(allMenus);
}

/**
 * Get all menu items as flat list (for admin editing)
 */
export async function getAllMenuItems() {
    return db
        .select()
        .from(authMenuItems)
        .orderBy(asc(authMenuItems.parent_id), asc(authMenuItems.sort_order));
}

/**
 * Update a menu item (label, icon, sort_order)
 */
export async function updateMenuItem(
    id: number,
    data: { label?: string; icon?: string; sort_order?: number }
) {
    const result = await db
        .update(authMenuItems)
        .set({ ...data})
        .where(eq(authMenuItems.id, id))
        .returning();
        
    cacheService.invalidate('menus:all');
    return result;
}

/**
 * Reorder multiple menu items
 */
export async function reorderMenuItems(items: { id: number; sort_order: number }[]) {
    if (items.length === 0) return [];

    // Single query with CASE WHEN instead of N individual updates
    const cases = items.map(i => sql`WHEN ${i.id} THEN ${i.sort_order}`);
    const ids = items.map(i => i.id);

    await db.execute(sql`
        UPDATE auth_menu_items SET
            sort_order = CASE id
                ${sql.join(cases, sql` `)}
            END,
        WHERE id IN (${sql.join(ids.map(id => sql`${id}`), sql`, `)})
    `);

    cacheService.invalidate('menus:all');
    return items;
}

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Filter menus based on user permissions using permission_prefix.
 * User must explicitly have the specific {prefix}.read permission to see a leaf menu,
 * and we must include all parent menus of accessible children to preserve the tree structure.
 */
function filterByPermissions(menus: DbMenuItem[], permissions: string[]): DbMenuItem[] {
    const permissionSet = new Set(permissions);
    const accessibleMenuIds = new Set<number>();

    // Step 1: Identify explicitly accessible menus
    for (const menu of menus) {
        if (!menu.permission_prefix) {
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
            permission: menu.permission_prefix ? `${menu.permission_prefix}.read` : undefined,
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
    const cleanNode = (node: any): ModuleConfig => {
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

