const nodeEnv = process.env.NODE_ENV || 'development';
const isProduction = nodeEnv === 'production';

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
  if (process.env.MICROSOFT_CLIENT_ID && process.env.MICROSOFT_TENANT_ID === 'common') {
    throw new Error('MICROSOFT_TENANT_ID debe ser explícito en producción');
  }
}

export const env = {
  DATABASE_URL: process.env.DATABASE_URL,
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
  GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID || '',
  GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET || '',
  MICROSOFT_CLIENT_ID: process.env.MICROSOFT_CLIENT_ID || '',
  MICROSOFT_CLIENT_SECRET: process.env.MICROSOFT_CLIENT_SECRET || '',
  MICROSOFT_TENANT_ID: process.env.MICROSOFT_TENANT_ID || 'common',
  TRUSTED_PROXY_HEADERS: process.env.TRUSTED_PROXY_HEADERS === 'true',
};
