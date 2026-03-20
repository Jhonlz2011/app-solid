import { text, integer, timestamp, index } from 'drizzle-orm/pg-core';
import { pgTableV2 } from '../utils';
import { authUsers } from './auth';

// --- AUDIT LOG (RBAC change tracking) ---
export const authAuditLog = pgTableV2("auth_audit_log", {
    id: integer("id").generatedAlwaysAsIdentity().primaryKey(),
    user_id: integer("user_id").references(() => authUsers.id).notNull(),
    action: text("action").notNull(),          // 'role.created', 'permission.updated', etc.
    target_type: text("target_type").notNull(), // 'role', 'user', 'permission', 'hierarchy'
    target_id: integer("target_id"),           // ID of the affected entity
    details: text("details"),                   // JSON stringified diff/context
    ip_address: text("ip_address"),
    created_at: timestamp("created_at").defaultNow().notNull(),
}, (t) => [
    index("idx_audit_user").on(t.user_id),
    index("idx_audit_target").on(t.target_type, t.target_id),
    index("idx_audit_created").on(t.created_at),
]);
