import { customType, text, integer, boolean, timestamp, primaryKey, smallint, foreignKey, index, uniqueIndex, varchar } from 'drizzle-orm/pg-core';
import { pgTableV2 } from '../utils';
import { entities } from './entities';


// 2. Custom Type para INET: Validación nativa de IPs en Postgres
const inet = customType<{ data: string }>({
  dataType() { return 'inet'; },
});

// --- 8. AUTH ---
export const authUsers = pgTableV2("auth_users", {
    id: integer("id").generatedAlwaysAsIdentity().primaryKey(),
    entity_id: integer("entity_id").references(() => entities.id),
    username: text("username").unique().notNull(),
    email: text("email").unique().notNull(),
    password_hash: text("password_hash").notNull(),
    is_active: boolean("is_active").default(true),
    last_login: timestamp("last_login", { withTimezone: true, mode: "date" }),
    created_at: timestamp("created_at", { withTimezone: true, mode: "date" })
        .defaultNow()
        .notNull(),
});

export const sessions = pgTableV2("sessions", {
    id: varchar("id", { length: 64 }).primaryKey(),               // Random 32-byte token (base64url)
    user_id: integer("user_id").references(() => authUsers.id, { onDelete: 'cascade' }).notNull(),
    user_agent: text("user_agent"),
    ip_address: inet("ip_address"),
    expires_at: timestamp("expires_at", { withTimezone: true, mode: "date" }).notNull(),
    created_at: timestamp("created_at", { withTimezone: true, mode: "date" }).defaultNow().notNull(),
}, (t) => [
    index("idx_sessions_user").on(t.user_id),
    index("idx_sessions_expires").on(t.expires_at),
]);

export const authRoles = pgTableV2("auth_roles", {
    id: integer("id").generatedAlwaysAsIdentity().primaryKey(),
    name: text("name").unique().notNull(),
    description: text("description"),
    is_system: boolean("is_system").default(false),     // superadmin, admin = non-deletable
    priority: smallint("priority").default(0),           // For conflict resolution in hierarchies
    created_at: timestamp("created_at", { withTimezone: true, mode: "date" }).defaultNow().notNull(),
});

export const authPermissions = pgTableV2("auth_permissions", {
    id: integer("id").generatedAlwaysAsIdentity().primaryKey(),
    module: text("module").notNull(),                   // 'suppliers', 'invoices'
    action: text("action").notNull(),                   // 'read', 'create', 'update', 'delete', etc.
    slug: text("slug").unique().notNull(),               // 'suppliers.read' (module.action)
    description: text("description"),
}, (t) => [
    uniqueIndex("idx_perm_module_action").on(t.module, t.action),
    index("idx_perm_module").on(t.module),
]);

export const authRolePermissions = pgTableV2("auth_role_permissions", {
    role_id: integer("role_id").references(() => authRoles.id, { onDelete: 'cascade' }).notNull(),
    permission_id: integer("permission_id").references(() => authPermissions.id, { onDelete: 'cascade' }).notNull(),
}, (t) => [
    primaryKey({ columns: [t.role_id, t.permission_id] }),
    index("idx_role_perms_by_perm").on(t.permission_id),
]);

export const authUserRoles = pgTableV2("auth_user_roles", {
    user_id: integer("user_id").references(() => authUsers.id, { onDelete: 'cascade' }).notNull(),
    role_id: integer("role_id").references(() => authRoles.id, { onDelete: 'cascade' }).notNull(),
}, (t) => [
    primaryKey({ columns: [t.user_id, t.role_id] }),
    index("idx_user_roles_by_role").on(t.role_id),
]);


// --- 9. MENU SYSTEM (Dynamic Menus) ---
export const authMenuItems = pgTableV2("auth_menu_items", {
    id: smallint("id").generatedAlwaysAsIdentity().primaryKey(),
    key: text("key").notNull().unique(),               // 'inventory', 'products'
    label: text("label").notNull(),                    // 'Inventario' (editable by admin)
    icon: text("icon"),                                // SVG path data
    path: text("path"),                                // '/products' (null for parent categories)
    parent_id: smallint("parent_id"),                   // Self-reference for tree hierarchy
    sort_order: smallint("sort_order").default(0),      // For custom ordering
    permission_prefix: text("permission_prefix"),      // 'products' -> maps to authPermissions.module
    is_active: boolean("is_active").default(true),
}, (t) => [
    foreignKey({ columns: [t.parent_id], foreignColumns: [t.id] }),
    index("idx_menu_parent").on(t.parent_id),
    index("idx_menu_order").on(t.parent_id, t.sort_order),
    index("idx_menu_active").on(t.is_active),
]);
