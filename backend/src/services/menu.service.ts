import { db } from '../db';
import { authMenuItems } from '../schema';
import { eq, isNull, asc } from 'drizzle-orm';
import { getUserPermissions, getUserRoles } from './rbac.service';

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
    const roles = await getUserRoles(userId);
    const isAdmin = roles.includes('admin') || roles.includes('superadmin');

    // Fetch all active menu items from DB
    const allMenus = await db
        .select()
        .from(authMenuItems)
        .where(eq(authMenuItems.is_active, true))
        .orderBy(asc(authMenuItems.sort_order));

    // For admins, return full tree
    if (isAdmin) {
        return buildMenuTree(allMenus);
    }

    // Get user permissions
    const permissions = await getUserPermissions(userId);

    // Filter menus based on permissions
    const filteredMenus = filterByPermissions(allMenus, permissions);

    return buildMenuTree(filteredMenus);
}

/**
 * Get full menu tree for admin panel (no permission filtering)
 */
export async function getFullMenuTree(): Promise<ModuleConfig[]> {
    const allMenus = await db
        .select()
        .from(authMenuItems)
        .where(eq(authMenuItems.is_active, true))
        .orderBy(asc(authMenuItems.sort_order));

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
    return db
        .update(authMenuItems)
        .set({ ...data, updated_at: new Date() })
        .where(eq(authMenuItems.id, id))
        .returning();
}

/**
 * Reorder multiple menu items
 */
export async function reorderMenuItems(items: { id: number; sort_order: number }[]) {
    const results = [];
    for (const item of items) {
        const [result] = await db
            .update(authMenuItems)
            .set({ sort_order: item.sort_order, updated_at: new Date() })
            .where(eq(authMenuItems.id, item.id))
            .returning();
        results.push(result);
    }
    return results;
}

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Filter menus based on user permissions using permission_prefix
 * If user has ANY permission starting with {prefix}., they can see the menu
 */
function filterByPermissions(menus: DbMenuItem[], permissions: string[]): DbMenuItem[] {
    const parentIds = new Set<number>();

    // First pass: find all menus user has access to
    const accessibleMenus = menus.filter(menu => {
        // No permission required
        if (!menu.permission_prefix) return true;

        // Check if user has any permission for this module
        const hasPermission = permissions.some(p =>
            p.startsWith(menu.permission_prefix + '.')
        );

        if (hasPermission && menu.parent_id) {
            parentIds.add(menu.parent_id);
        }

        return hasPermission;
    });

    // Second pass: include parents that have accessible children
    const result = menus.filter(menu => {
        // Already included
        if (accessibleMenus.includes(menu)) return true;
        // Is a parent of an accessible menu
        if (parentIds.has(menu.id)) return true;
        return false;
    });

    // Final filter: remove parents with no accessible children and no path
    return result.filter(menu => {
        if (menu.path) return true;
        // Check if this parent has any children in result
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

