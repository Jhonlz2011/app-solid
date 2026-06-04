import { pgTableCreator, pgPolicy } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

export const pgTableV2 = pgTableCreator((name) => name);

export const TZ = { withTimezone: true, mode: "date" } as const;

/**
 * Standard RLS policy for tenant-scoped tables.
 * Ensures rows are only visible/modifiable when app.current_company_id matches the row's company_id.
 * Fail-closed: if no tenant context is set, current_setting returns NULL → no rows match.
 */
export function tenantPolicy(columnName = 'company_id') {
  return pgPolicy('tenant_isolation', {
    as: 'permissive',
    for: 'all',
    to: 'public',
    using: sql`${sql.raw(columnName)} = current_setting('app.current_company_id', true)::integer`,
    withCheck: sql`${sql.raw(columnName)} = current_setting('app.current_company_id', true)::integer`,
  });
}
