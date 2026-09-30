export const DATABASE_SSL_MODES = ['disable', 'require', 'verify-full'] as const;
export type DatabaseSslMode = typeof DATABASE_SSL_MODES[number];

type PostgresSslOption = false | 'require' | 'verify-full';

/**
 * Resolve TLS consistently for application, seed, worker, and migration clients.
 * Production defaults to TLS; private-network deployments that intentionally
 * terminate TLS elsewhere must explicitly set DATABASE_SSL_MODE=disable.
 */
export function resolveDatabaseSslMode(
  configured: string | undefined,
  fallback: DatabaseSslMode = process.env.NODE_ENV === 'production' ? 'require' : 'disable',
): DatabaseSslMode {
  if (!configured?.trim()) return fallback;

  const mode = configured.trim().toLowerCase();
  if ((DATABASE_SSL_MODES as readonly string[]).includes(mode)) {
    return mode as DatabaseSslMode;
  }

  throw new Error(
    `Invalid database SSL mode "${configured}". Expected one of: ${DATABASE_SSL_MODES.join(', ')}`,
  );
}

export function toPostgresSslOption(mode: DatabaseSslMode): PostgresSslOption {
  return mode === 'disable' ? false : mode;
}
