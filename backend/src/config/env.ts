if (!process.env.DATABASE_URL || !process.env.FRONTEND_URL || !process.env.SRI_DATABASE_URL) {
  throw new Error('Variables de entorno requeridas no encontradas (DATABASE_URL, FRONTEND_URL, SRI_DATABASE_URL)');
}

export const env = {
  DATABASE_URL: process.env.DATABASE_URL,
  ADMIN_DATABASE_URL: process.env.ADMIN_DATABASE_URL || process.env.DATABASE_URL,
  SRI_DATABASE_URL: process.env.SRI_DATABASE_URL,
  FRONTEND_URL: process.env.FRONTEND_URL,
  FRONTEND_INTERNAL_URL: process.env.FRONTEND_INTERNAL_URL || '',
  PORT: process.env.PORT ? parseInt(process.env.PORT) : 3000,
  NODE_ENV: (process.env.NODE_ENV || 'development') as 'development' | 'production' | 'test',
  BETTER_AUTH_SECRET: process.env.BETTER_AUTH_SECRET || 'zelys-erp-better-auth-secret-key-development-mode-2026',
  BETTER_AUTH_URL: process.env.BETTER_AUTH_URL || `http://localhost:${process.env.PORT || 3000}`,
  COOKIE_DOMAIN: process.env.COOKIE_DOMAIN || '',
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
};