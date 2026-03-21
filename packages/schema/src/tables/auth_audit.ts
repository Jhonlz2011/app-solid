// import { text, integer, timestamp, index } from 'drizzle-orm/pg-core';
// import { pgTableV2 } from '../utils';
// import { authUsers } from './auth';

// // --- AUDIT LOG (RBAC change tracking) ---
// export const auditLogs = pgTableV2("audit_logs", {
//     id: integer("id").generatedAlwaysAsIdentity().primaryKey(),
//     user_id: integer("user_id").references(() => authUsers.id).notNull(),
//     action: text("action").notNull(),          // 'role.created', 'permission.updated', etc.
//     target_type: text("target_type").notNull(), // 'role', 'user', 'permission', 'hierarchy'
//     target_id: integer("target_id"),           // ID of the affected entity
//     details: text("details"),                   // JSON stringified diff/context
//     ip_address: text("ip_address"),
//     created_at: timestamp("created_at").defaultNow().notNull(),
// }, (t) => [
//     index("idx_audit_user").on(t.user_id),
//     index("idx_audit_target").on(t.target_type, t.target_id),
//     index("idx_audit_created").on(t.created_at),
// ]);

import { 
  pgTable, timestamp, jsonb, index, varchar, uuid, pgEnum, customType, integer
} from 'drizzle-orm/pg-core';
import { v7 as uuidv7 } from 'uuid'; // Generación de UUIDv7 en Bun
import { authUsers } from './auth';

// 1. ENUM: Ahorra millones de bytes guardando un entero (4 bytes) en lugar de texto
export const actionEnum = pgEnum('audit_action', ['INSERT', 'UPDATE', 'DELETE', 'LOGIN', 'EXPORT']);

// 2. Custom Type para INET: Validación nativa de IPs en Postgres
const inet = customType<{ data: string }>({
  dataType() { return 'inet'; },
});

export const auditLogs = pgTable("audit_logs", {
    // Generación descentralizada cronológica. Rápida y sin fragmentar el índice.
    id: uuid("id").primaryKey().$defaultFn(() => uuidv7()), 
    // Identificadores Polimórficos
    tableName: varchar("table_name", { length: 64 }).notNull(),
    recordId: varchar("record_id", { length: 128 }).notNull(),
    action: actionEnum("action").notNull(),
    // Solo guardamos el JSON, pero NO lo indexamos con GIN para mantener las escrituras a 0ms
    oldData: jsonb("old_data"),
    newData: jsonb("new_data"),
    // Foreign Key segura: Si borras un admin, el log se mantiene pero el user_id queda en NULL
    userId: integer("user_id").references(() => authUsers.id, { onDelete: "set null" }), 
    
    ipAddress: inet("ip_address"),     
    
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
        .defaultNow()
        .notNull(),
}, (t) => [
    // EL ÍNDICE MÁS IMPORTANTE: Compuesto por Tabla + ID del Registro
    index("idx_audit_target").on(t.tableName, t.recordId),
    
    // Índice para buscar qué hizo un usuario específico
    index("idx_audit_user").on(t.userId),
    
    // Índice para filtrar por rangos de fecha rápidos
    index("idx_audit_date").on(t.createdAt),
]);