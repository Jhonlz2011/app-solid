import { pgTable, integer, varchar, timestamp, jsonb, index, unique } from 'drizzle-orm/pg-core';
import { authUsers } from './auth';

/**
 * email_logs — Almacena eventos del ciclo de vida de los correos enviados vía Resend.
 * Poblado por el webhook de Resend (POST /api/webhooks/resend).
 * 
 * Eventos: email.sent, email.delivered, email.bounced, email.complained, email.failed, etc.
 */
export const emailLogs = pgTable('email_logs', {
  id: integer('id').generatedAlwaysAsIdentity().primaryKey(),
  userId: integer('user_id').references(() => authUsers.id, { onDelete: 'set null' }),
  toEmail: varchar('to_email', { length: 255 }).notNull(),
  subject: varchar('subject', { length: 255 }).notNull(),
  status: varchar('status', { length: 50 }).notNull(),
  eventType: varchar('event_type', { length: 100 }),
  resendId: varchar('resend_id', { length: 255 }),
  metadata: jsonb('metadata'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (t) => [
  index('idx_email_logs_resend_id').on(t.resendId),
  index('idx_email_logs_to_email').on(t.toEmail),
  index('idx_email_logs_status').on(t.status),
  unique('unq_email_logs_resend_event').on(t.resendId, t.eventType),
]);

export type EmailLog = typeof emailLogs.$inferSelect;
export type NewEmailLog = typeof emailLogs.$inferInsert;
