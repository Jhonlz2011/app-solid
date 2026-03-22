import { 
  pgTable, timestamp, jsonb, index, varchar, uuid, pgEnum, customType, integer, text, primaryKey
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
    id: uuid("id").$defaultFn(() => uuidv7()).notNull(),    // Identificadores Polimórficos
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

    primaryKey({ columns: [t.id, t.createdAt] }),
    // EL ÍNDICE MÁS IMPORTANTE: Compuesto por Tabla + ID del Registro
    index("idx_audit_target").on(t.tableName, t.recordId),
    
    // Índice para buscar qué hizo un usuario específico
    index("idx_audit_user").on(t.userId),
    
    // Índice para filtrar por rangos de fecha rápidos
]);

// Esta es la tabla temporal ultraligera
export const auditQueue = pgTable("_audit_queue", {
    id: integer("id").generatedAlwaysAsIdentity({ cycle:true }).primaryKey(),
    tableName: text("table_name").notNull(),
    recordId: text("record_id").notNull(),
    action: text("action").notNull(),
    oldData: jsonb("old_data"),
    newData: jsonb("new_data"),
    userId: text("user_id"),
    ipAddress: text("ip_address"),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).defaultNow().notNull(),
});