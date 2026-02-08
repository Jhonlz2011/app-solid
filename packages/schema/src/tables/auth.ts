import { text, integer, boolean, timestamp, primaryKey, smallint, foreignKey, index } from 'drizzle-orm/pg-core';
import { pgTableV2 } from '../utils';
import { entities } from './entities';

// --- 8. AUTH ---
export const authUsers = pgTableV2("auth_users", {
    id: integer("id").generatedAlwaysAsIdentity().primaryKey(),
    entity_id: integer("entity_id").references(() => entities.id),
    username: text("username").unique().notNull(),
    email: text("email").unique().notNull(),
    password_hash: text("password_hash").notNull(),
    is_active: boolean("is_active").default(true),
    last_login: timestamp("last_login"),
    created_at: timestamp("created_at").defaultNow().notNull(),
});

export const refreshTokens = pgTableV2("refresh_tokens", {
    id: integer("id").generatedAlwaysAsIdentity().primaryKey(),
    user_id: integer("user_id").references(() => authUsers.id, { onDelete: 'cascade' }).notNull(),
    selector: text("selector").notNull().unique(),
    token_hash: text("token_hash").notNull(),
    session_chain_id: text("session_chain_id").notNull(), // Persists through rotations to identify logical session
    created_at: timestamp("created_at").defaultNow().notNull(),
    expires_at: timestamp("expires_at").notNull(),
    last_activity: timestamp("last_activity").defaultNow().notNull(),
    revoked: boolean("revoked").default(false),
    replaced_by: integer("replaced_by"),
    user_agent: text("user_agent"),
    ip_address: text("ip_address"),
});

export const authRoles = pgTableV2("auth_roles", {
    id: integer("id").generatedAlwaysAsIdentity().primaryKey(),
    name: text("name").unique().notNull(),
    description: text("description"),
});

export const authPermissions = pgTableV2("auth_permissions", {
    id: integer("id").generatedAlwaysAsIdentity().primaryKey(),
    slug: text("slug").unique().notNull(),
    description: text("description"),
});

export const authRolePermissions = pgTableV2("auth_role_permissions", {
    role_id: integer("role_id").references(() => authRoles.id, { onDelete: 'cascade' }).notNull(),
    permission_id: integer("permission_id").references(() => authPermissions.id, { onDelete: 'cascade' }).notNull(),
}, (t) => [primaryKey({ columns: [t.role_id, t.permission_id] })]);

export const authUserRoles = pgTableV2("auth_user_roles", {
    user_id: integer("user_id").references(() => authUsers.id, { onDelete: 'cascade' }).notNull(),
    role_id: integer("role_id").references(() => authRoles.id, { onDelete: 'cascade' }).notNull(),
}, (t) => [primaryKey({ columns: [t.user_id, t.role_id] })]);

// --- 9. MENU SYSTEM (Dynamic Menus) ---
export const authMenuItems = pgTableV2("auth_menu_items", {
    id: smallint("id").generatedAlwaysAsIdentity().primaryKey(),
    key: text("key").notNull().unique(),               // 'inventory', 'products'
    label: text("label").notNull(),                    // 'Inventario' (editable by admin)
    icon: text("icon"),                                // SVG path data
    path: text("path"),                                // '/products' (null for parent categories)
    parent_id: smallint("parent_id"),                   // Self-reference for tree hierarchy
    sort_order: smallint("sort_order").default(0),      // For custom ordering
    permission_prefix: text("permission_prefix"),      // 'products' -> products.read/.add/.edit/.delete
    is_active: boolean("is_active").default(true),
    created_at: timestamp("created_at").defaultNow().notNull(),
    updated_at: timestamp("updated_at").defaultNow().notNull(),
}, (t) => [
    foreignKey({ columns: [t.parent_id], foreignColumns: [t.id] }),
    index("idx_menu_parent").on(t.parent_id),
    index("idx_menu_order").on(t.parent_id, t.sort_order),
    index("idx_menu_active").on(t.is_active),
]);
