import { MODULES_CONFIG, ModuleConfig } from '../config/menu';
import { getUserPermissions, getUserRoles } from './rbac.service';

export async function getMenuForUser(userId: number): Promise<ModuleConfig[]> {
    const roles = await getUserRoles(userId);
    const isAdmin = roles.includes('admin') || roles.includes('superadmin');

    if (isAdmin) {
        return MODULES_CONFIG;
    }

    const permissions = await getUserPermissions(userId);

    const filterModules = (items: ModuleConfig[]): ModuleConfig[] => {
        return items
            .filter((mod) => {
                // If no permission is required, show it
                if (!mod.permission) return true;
                // Check if user has the specific permission
                return permissions.includes(mod.permission);
            })
            .map((mod) => ({
                ...mod,
                // Recursively filter children
                children: mod.children ? filterModules(mod.children) : undefined,
            }))
            // Remove items that have children but all children were filtered out
            // (Optional: depends on if you want to show empty parent categories)
            // For now, let's keep parents if they have permission, even if empty children
            // But usually, if a parent has no children and no path, it shouldn't be shown?
            // Let's assume if it has a path it's a link, if not it's a category.
            .filter((mod) => {
                if (mod.path) return true; // It's a link, keep it
                if (mod.children && mod.children.length > 0) return true; // Has visible children
                return false; // Empty category, hide it
            });
    };

    return filterModules(MODULES_CONFIG);
}
