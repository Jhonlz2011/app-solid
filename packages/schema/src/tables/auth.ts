import { customType, text, integer, boolean, timestamp, primaryKey, smallint, foreignKey, index, uniqueIndex, varchar, pgPolicy } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { pgTableV2, TZ, tenantPolicy } from '../utils';
import { entities } from './entities';
import { companies } from './config';


// 2. Custom Type para INET: Validación nativa de IPs en Postgres
const inet = customType<{ data: string }>({
  dataType() { return 'inet'; },
});

// --- 8. AUTH ---
export const authUsers = pgTableV2("auth_users", {
    id: integer("id").generatedAlwaysAsIdentity().primaryKey(),
    company_id: integer("company_id").references(() => companies.id).notNull(),
    entity_id: integer("entity_id").references(() => entities.id),
    username: text("username").notNull(),
    email: text("email").notNull(),
    password_hash: text("password_hash").notNull(),
    is_active: boolean("is_active").default(true),
    is_owner: boolean("is_owner").default(false).notNull(),          // true = company creator
    email_verified_at: timestamp("email_verified_at", TZ),          // null = not verified
    last_login: timestamp("last_login", TZ),
    created_at: timestamp("created_at", TZ)
        .defaultNow()
        .notNull(),
}, (t) => [
    uniqueIndex("idx_auth_users_username").on(t.company_id, t.username),
    uniqueIndex("idx_auth_users_email").on(t.company_id, t.email),
    index("idx_auth_users_company").on(t.company_id),
    pgPolicy('tenant_isolation', {
        as: 'permissive',
        for: 'all',
        to: 'public',
        using: sql`company_id = current_setting('app.current_company_id', true)::integer
            OR username = current_setting('app.current_username', true)
            OR email = current_setting('app.current_username', true)`,
        withCheck: sql`company_id = current_setting('app.current_company_id', true)::integer`,
    }),
]).enableRLS();

export const sessions = pgTableV2("sessions", {
    id: varchar("id", { length: 64 }).primaryKey(),               // Random 32-byte token (base64url)
    user_id: integer("user_id").references(() => authUsers.id, { onDelete: 'cascade' }).notNull(),
    company_id: integer("company_id").references(() => companies.id).notNull(),
    user_agent: text("user_agent"),
    ip_address: inet("ip_address"),
    expires_at: timestamp("expires_at", TZ).notNull(),
    created_at: timestamp("created_at", TZ).defaultNow().notNull(),
}, (t) => [
    index("idx_sessions_user").on(t.user_id),
    index("idx_sessions_expires").on(t.expires_at),
    index("idx_sessions_company").on(t.company_id),
    pgPolicy('tenant_isolation', {
        as: 'permissive',
        for: 'all',
        to: 'public',
        using: sql`company_id = current_setting('app.current_company_id', true)::integer
            OR id = current_setting('app.current_session_id', true)`,
        withCheck: sql`company_id = current_setting('app.current_company_id', true)::integer`,
    }),
]).enableRLS();

export const authRoles = pgTableV2("auth_roles", {
    id: integer("id").generatedAlwaysAsIdentity().primaryKey(),
    company_id: integer("company_id").references(() => companies.id).notNull(),
    name: text("name").notNull(),
    description: text("description"),
    is_system: boolean("is_system").default(false),     // superadmin, admin = non-deletable
    priority: smallint("priority").default(0),           // For conflict resolution in hierarchies
    created_at: timestamp("created_at", TZ).defaultNow().notNull(),
}, (t) => [
    uniqueIndex("idx_auth_roles_name").on(t.company_id, t.name),
    index("idx_auth_roles_company").on(t.company_id),
    tenantPolicy(),
]).enableRLS();

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

export const authVerificationTokens = pgTableV2("auth_verification_tokens", {
    id: integer("id").generatedAlwaysAsIdentity().primaryKey(),
    user_id: integer("user_id").references(() => authUsers.id, { onDelete: 'cascade' }).notNull(),
    token_hash: text("token_hash").notNull(),
    expires_at: timestamp("expires_at", TZ).notNull(),
    created_at: timestamp("created_at", TZ).defaultNow().notNull(),
}, (t) => [
    index("idx_auth_verif_tokens_user").on(t.user_id),
    index("idx_auth_verif_tokens_hash").on(t.token_hash),
]);

