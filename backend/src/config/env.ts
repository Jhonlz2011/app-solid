import { resolveDatabaseSslMode, type DatabaseSslMode } from '../core/db/postgres-options';

const nodeEnv = process.env.NODE_ENV || 'development';
const isProduction = nodeEnv === 'production';
const databaseSslMode = resolveDatabaseSslMode(process.env.DATABASE_SSL_MODE);
const referenceDatabaseSslMode = resolveDatabaseSslMode(process.env.REF_DATABASE_SSL_MODE, databaseSslMode);
const adminDatabaseSslMode = resolveDatabaseSslMode(process.env.ADMIN_DATABASE_SSL_MODE, databaseSslMode);

const googleClientId = (process.env.GOOGLE_CLIENT_ID || '').trim();
const googleClientSecret = (process.env.GOOGLE_CLIENT_SECRET || '').trim();
const microsoftClientId = (process.env.MICROSOFT_CLIENT_ID || '').trim();
const microsoftClientSecret = (process.env.MICROSOFT_CLIENT_SECRET || '').trim();
const microsoftTenantId = (process.env.MICROSOFT_TENANT_ID || 'common').trim();
const VALID_MICROSOFT_TENANT_RE = /^(common|organizations|consumers|[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i;

if (!process.env.DATABASE_URL || !process.env.FRONTEND_URL || !process.env.REF_DATABASE_URL) {
  throw new Error('Variables de entorno requeridas no encontradas (DATABASE_URL, FRONTEND_URL, REF_DATABASE_URL)');
}

if (isProduction) {
  if (!process.env.BETTER_AUTH_SECRET || process.env.BETTER_AUTH_SECRET.length < 32) {
    throw new Error('BETTER_AUTH_SECRET debe existir y tener al menos 32 caracteres en producción');
  }
  if (!process.env.TURNSTILE_SECRET_KEY || !process.env.TURNSTILE_SITE_KEY) {
    throw new Error('TURNSTILE_SECRET_KEY y TURNSTILE_SITE_KEY son obligatorios en producción');
  }
  if (process.env.TRUSTED_PROXY_HEADERS !== 'true') {
    throw new Error('TRUSTED_PROXY_HEADERS=true es obligatorio cuando la aplicación está detrás de un proxy confiable');
  }
  if (Boolean(microsoftClientId) !== Boolean(microsoftClientSecret)) {
    throw new Error('MICROSOFT_CLIENT_ID y MICROSOFT_CLIENT_SECRET deben configurarse juntos (o ambos vacíos)');
  }
  if (microsoftClientId && !VALID_MICROSOFT_TENANT_RE.test(microsoftTenantId)) {
    throw new Error('MICROSOFT_TENANT_ID inválido: usa common, organizations, consumers o un Tenant GUID válido');
  }
}

export const env = {
  DATABASE_URL: process.env.DATABASE_URL,
  DATABASE_SSL_MODE: databaseSslMode as DatabaseSslMode,
  REF_DATABASE_SSL_MODE: referenceDatabaseSslMode as DatabaseSslMode,
  ADMIN_DATABASE_SSL_MODE: adminDatabaseSslMode as DatabaseSslMode,
  // Keep a separate pool for global workers. Production validates that this
  // URL is explicitly configured instead of silently connecting to localhost.
  ADMIN_DATABASE_URL: process.env.ADMIN_DATABASE_URL || process.env.DATABASE_URL,
  REF_DATABASE_URL: process.env.REF_DATABASE_URL,
  FRONTEND_URL: process.env.FRONTEND_URL,
  FRONTEND_INTERNAL_URL: process.env.FRONTEND_INTERNAL_URL || '',
  API_PUBLIC_URL: process.env.API_PUBLIC_URL || '',
  PORT: process.env.PORT ? parseInt(process.env.PORT) : 3000,
  NODE_ENV: nodeEnv as 'development' | 'production' | 'test',
  BETTER_AUTH_SECRET: process.env.BETTER_AUTH_SECRET || 'zelys-erp-better-auth-secret-key-development-mode-2026',
  BETTER_AUTH_URL: process.env.BETTER_AUTH_URL || `http://localhost:${process.env.PORT || 3000}`,
  REDIS_URL: process.env.REDIS_URL || 'redis://localhost:6379',
  GEONAMES_USERNAME: process.env.GEONAMES_USERNAME || '',
  // Cloudflare R2
  R2_ENDPOINT_PUBLIC: process.env.R2_ENDPOINT_PUBLIC || '',
  R2_ACCESS_KEY_ID_PUBLIC: process.env.R2_ACCESS_KEY_ID_PUBLIC || '',
  R2_SECRET_ACCESS_KEY_PUBLIC: process.env.R2_SECRET_ACCESS_KEY_PUBLIC || '',
  R2_BUCKET_NAME_PUBLIC: process.env.R2_BUCKET_NAME_PUBLIC || 'zelys-erp-public',
  NEXT_PUBLIC_CDN_URL: process.env.NEXT_PUBLIC_CDN_URL || 'https://cdn.zelys.app',

  R2_ACCESS_KEY_ID_PRIVATE: process.env.R2_ACCESS_KEY_ID_PRIVATE || '',
  R2_SECRET_ACCESS_KEY_PRIVATE: process.env.R2_SECRET_ACCESS_KEY_PRIVATE || '',
  R2_BUCKET_NAME_PRIVATE: process.env.R2_BUCKET_NAME_PRIVATE || 'zelys-erp-private',
  R2_ENDPOINT_PRIVATE: process.env.R2_ENDPOINT_PRIVATE || '',
  // Resend (Email Service)
  RESEND_API_KEY: process.env.RESEND_API_KEY || '',
  RESEND_WEBHOOK_SECRET: process.env.RESEND_WEBHOOK_SECRET || '',
  // Cloudflare Turnstile
  TURNSTILE_SITE_KEY: process.env.TURNSTILE_SITE_KEY || '',
  TURNSTILE_SECRET_KEY: process.env.TURNSTILE_SECRET_KEY || '',
  // OAuth (Google & Microsoft Entra ID)
  GOOGLE_CLIENT_ID: googleClientId,
  GOOGLE_CLIENT_SECRET: googleClientSecret,
  MICROSOFT_CLIENT_ID: microsoftClientId,
  MICROSOFT_CLIENT_SECRET: microsoftClientSecret,
  MICROSOFT_TENANT_ID: microsoftTenantId,
  TRUSTED_PROXY_HEADERS: process.env.TRUSTED_PROXY_HEADERS === 'true',
};
