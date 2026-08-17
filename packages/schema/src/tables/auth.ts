import { customType, text, integer, boolean, timestamp, primaryKey, smallint, foreignKey, index, uniqueIndex, pgPolicy, uuid } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { pgTableV2, TZ, tenantPolicy } from '../utils';
import { entities } from './entities';
import { companies } from './config';
import { menuItemStatusEnum } from '../enums';

// Custom Type para INET: Validación nativa de IPs en Postgres
const inet = customType<{ data: string }>({
  dataType() { return 'inet'; },
});

// ============================================================================
// 1. BETTER-AUTH CORE TABLES (PostgreSQL 18 Native UUIDv7)
// ============================================================================

export const user = pgTableV2("user", {
    id: uuid("id").primaryKey().default(sql`uuidv7()`),
    name: text("name").notNull(),
    email: text("email").notNull().unique(),
    emailVerified: boolean("email_verified").default(false).notNull(),
    image: text("image"),
    createdAt: timestamp("created_at", TZ).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", TZ).defaultNow().notNull(),
    
    // Better-Auth username plugin
    username: text("username").unique(),
    displayUsername: text("display_username"),
    
    // Better-Auth twoFactor plugin
    twoFactorEnabled: boolean("two_factor_enabled").default(false),
    
    // Custom ERP domain fields
    company_id: integer("company_id").references(() => companies.id),
    entity_id: integer("entity_id").references(() => entities.id),
    is_active: boolean("is_active").default(true),
    is_owner: boolean("is_owner").default(false).notNull(),
    last_login: timestamp("last_login", TZ),
}, (t) => [
    index("idx_user_email").on(t.email),
    index("idx_user_username").on(t.username),
    index("idx_user_company").on(t.company_id),
    pgPolicy('tenant_isolation', {
        as: 'permissive',
        for: 'all',
        to: 'public',
        using: sql`company_id IS NULL OR company_id = current_setting('app.current_company_id', true)::integer
            OR username = current_setting('app.current_username', true)
            OR email = current_setting('app.current_username', true)`,
        withCheck: sql`company_id IS NULL OR company_id = current_setting('app.current_company_id', true)::integer`,
    }),
]).enableRLS();

export const session = pgTableV2("session", {
    id: text("id").primaryKey().default(sql`uuidv7()::text`),
    expiresAt: timestamp("expires_at", TZ).notNull(),
    token: text("token").notNull().unique(),
    createdAt: timestamp("created_at", TZ).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", TZ).defaultNow().notNull(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    userId: uuid("user_id").references(() => user.id, { onDelete: 'cascade' }).notNull(),
    activeOrganizationId: text("active_organization_id"),
    company_id: integer("company_id").references(() => companies.id),
}, (t) => [
    index("idx_session_user").on(t.userId),
    index("idx_session_token").on(t.token),
    index("idx_session_expires").on(t.expiresAt),
    index("idx_session_company").on(t.company_id),
    pgPolicy('tenant_isolation', {
        as: 'permissive',
        for: 'all',
        to: 'public',
        using: sql`company_id IS NULL OR company_id = current_setting('app.current_company_id', true)::integer
            OR token = current_setting('app.current_session_id', true)
            OR id = current_setting('app.current_session_id', true)`,
        withCheck: sql`company_id IS NULL OR company_id = current_setting('app.current_company_id', true)::integer`,
    }),
]).enableRLS();

export const account = pgTableV2("account", {
    id: uuid("id").primaryKey().default(sql`uuidv7()`),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    userId: uuid("user_id").references(() => user.id, { onDelete: 'cascade' }).notNull(),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: timestamp("access_token_expires_at", TZ),
    refreshTokenExpiresAt: timestamp("refresh_token_expires_at", TZ),
    scope: text("scope"),
    password: text("password"),
    createdAt: timestamp("created_at", TZ).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", TZ).defaultNow().notNull(),
}, (t) => [
    index("idx_account_user").on(t.userId),
    uniqueIndex("idx_account_provider_unique").on(t.providerId, t.accountId),
]);

export const verification = pgTableV2("verification", {
    id: text("id").primaryKey().default(sql`uuidv7()::text`),
    identifier: text("identifier").notNull(),
    value: text("value").notNull(),
    expiresAt: timestamp("expires_at", TZ).notNull(),
    createdAt: timestamp("created_at", TZ).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", TZ).defaultNow().notNull(),
}, (t) => [
    index("idx_verification_identifier").on(t.identifier),
]);

// Better-Auth Organization Plugin Tables
export const organization = pgTableV2("organization", {
    id: text("id").primaryKey().default(sql`uuidv7()::text`),
    name: text("name").notNull(),
    slug: text("slug").unique(),
    logo: text("logo"),
    createdAt: timestamp("created_at", TZ).defaultNow().notNull(),
    metadata: text("metadata"),
}, (t) => [
    index("idx_org_slug").on(t.slug),
]);

export const member = pgTableV2("member", {
    id: uuid("id").primaryKey().default(sql`uuidv7()`),
    organizationId: text("organization_id").references(() => organization.id, { onDelete: 'cascade' }).notNull(),
    userId: uuid("user_id").references(() => user.id, { onDelete: 'cascade' }).notNull(),
    role: text("role").default("member").notNull(),
    createdAt: timestamp("created_at", TZ).defaultNow().notNull(),
}, (t) => [
    index("idx_member_org").on(t.organizationId),
    index("idx_member_user").on(t.userId),
]);

export const invitation = pgTableV2("invitation", {
    id: uuid("id").primaryKey().default(sql`uuidv7()`),
    organizationId: text("organization_id").references(() => organization.id, { onDelete: 'cascade' }).notNull(),
    email: text("email").notNull(),
    role: text("role"),
    status: text("status").notNull(),
    expiresAt: timestamp("expires_at", TZ).notNull(),
    inviterId: uuid("inviter_id").references(() => user.id, { onDelete: 'cascade' }).notNull(),
}, (t) => [
    index("idx_invitation_org").on(t.organizationId),
    index("idx_invitation_email").on(t.email),
]);

// Better-Auth Two-Factor & Passkey Plugins
export const twoFactor = pgTableV2("two_factor", {
    id: uuid("id").primaryKey().default(sql`uuidv7()`),
    secret: text("secret").notNull(),
    backupCodes: text("backup_codes").notNull(),
    userId: uuid("user_id").references(() => user.id, { onDelete: 'cascade' }).notNull(),
}, (t) => [
    index("idx_two_factor_user").on(t.userId),
]);

export const passkey = pgTableV2("passkey", {
    id: text("id").primaryKey(),
    name: text("name"),
    publicKey: text("public_key").notNull(),
    userId: uuid("user_id").references(() => user.id, { onDelete: 'cascade' }).notNull(),
    credentialID: text("credential_i_d").notNull(),
    counter: integer("counter").notNull(),
    deviceType: text("device_type").notNull(),
    backedUp: boolean("backed_up").notNull(),
    transports: text("transports"),
    createdAt: timestamp("created_at", TZ),
}, (t) => [
    index("idx_passkey_user").on(t.userId),
]);

// Backward compatibility aliases
export const authUsers = user;
export const sessions = session;
export const authVerificationTokens = verification;

// ============================================================================
// 2. RBAC & PERMISSIONS SYSTEM
// ============================================================================

export const authRoles = pgTableV2("auth_roles", {
    id: integer("id").generatedAlwaysAsIdentity().primaryKey(),
    company_id: integer("company_id").references(() => companies.id).notNull(),
    name: text("name").notNull(),
    description: text("description"),
    is_system: boolean("is_system").default(false),     // superadmin, admin = non-deletable
    priority: smallint("priority").default(0),           // For conflict resolution in hierarchies
    createdAt: timestamp("created_at", TZ).defaultNow().notNull(),
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
    company_id: integer("company_id").references(() => companies.id).notNull(),
}, (t) => [
    primaryKey({ columns: [t.role_id, t.permission_id] }),
    index("idx_role_perms_by_perm").on(t.permission_id),
    index("idx_role_perms_company").on(t.company_id),
    tenantPolicy(),
]).enableRLS();

export const authUserRoles = pgTableV2("auth_user_roles", {
    user_id: uuid("user_id").references(() => user.id, { onDelete: 'cascade' }).notNull(),
    role_id: integer("role_id").references(() => authRoles.id, { onDelete: 'cascade' }).notNull(),
    company_id: integer("company_id").references(() => companies.id).notNull(),
}, (t) => [
    primaryKey({ columns: [t.user_id, t.role_id] }),
    index("idx_user_roles_by_role").on(t.role_id),
    index("idx_user_roles_company").on(t.company_id),
    tenantPolicy(),
]).enableRLS();

// ============================================================================
// 3. MENU SYSTEM (Dynamic Menus)
// ============================================================================

export const authMenuItems = pgTableV2("auth_menu_items", {
    id: smallint("id").generatedAlwaysAsIdentity().primaryKey(),
    key: text("key").notNull().unique(),               // 'inventory', 'products'
    label: text("label").notNull(),                    // 'Inventario' (editable by admin)
    icon: text("icon"),                                // SVG path data
    path: text("path"),                                // '/products' (null for parent categories)
    parent_id: smallint("parent_id"),                   // Self-reference for tree hierarchy
    sort_order: smallint("sort_order").default(0),      // For custom ordering
    permission_prefix: text("permission_prefix"),      // 'products' -> maps to authPermissions.module
    status: menuItemStatusEnum("status").default('active'),
}, (t) => [
    foreignKey({ columns: [t.parent_id], foreignColumns: [t.id] }),
    index("idx_menu_parent").on(t.parent_id),
    index("idx_menu_order").on(t.parent_id, t.sort_order),
    index("idx_menu_active").on(t.status),
]);
