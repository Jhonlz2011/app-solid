if (!process.env.DATABASE_URL || !process.env.FRONTEND_URL || !process.env.SRI_DATABASE_URL) {
  throw new Error('Variables de entorno requeridas no encontradas');
}

export const env = {
  DATABASE_URL: process.env.DATABASE_URL,
  ADMIN_DATABASE_URL: process.env.ADMIN_DATABASE_URL || process.env.DATABASE_URL,
  SRI_DATABASE_URL: process.env.SRI_DATABASE_URL,
  FRONTEND_URL: process.env.FRONTEND_URL,
  FRONTEND_INTERNAL_URL: process.env.FRONTEND_INTERNAL_URL || '',
  PORT: process.env.PORT ? parseInt(process.env.PORT) : 3000,
  NODE_ENV: (process.env.NODE_ENV || 'development') as 'development' | 'production' | 'test',
  REDIS_URL: process.env.REDIS_URL || 'redis://localhost:6379',
  GEONAMES_USERNAME: process.env.GEONAMES_USERNAME || '',
  COOKIE_DOMAIN: process.env.COOKIE_DOMAIN || '',
  AWS_REGION: process.env.AWS_REGION || 'us-east-2',
  AWS_ACCESS_KEY_ID: process.env.AWS_ACCESS_KEY_ID || '',
  AWS_SECRET_ACCESS_KEY: process.env.AWS_SECRET_ACCESS_KEY || '',
  R2_ENDPOINT: process.env.R2_ENDPOINT || '',
  R2_ACCESS_KEY_ID: process.env.R2_ACCESS_KEY_ID || '',
  R2_SECRET_ACCESS_KEY: process.env.R2_SECRET_ACCESS_KEY || '',
  R2_BUCKET_NAME: process.env.R2_BUCKET_NAME || 'zelys-erp-public',
  NEXT_PUBLIC_CDN_URL: process.env.NEXT_PUBLIC_CDN_URL || 'https://cdn.zelys.app',
  // Resend (Email Service)
  RESEND_API_KEY: process.env.RESEND_API_KEY || '',
  RESEND_WEBHOOK_SECRET: process.env.RESEND_WEBHOOK_SECRET || '',
  TURNSTILE_SITE_KEY: process.env.TURNSTILE_SITE_KEY || '',
  TURNSTILE_SECRET_KEY: process.env.TURNSTILE_SECRET_KEY || '',
};